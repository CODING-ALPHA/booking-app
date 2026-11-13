import crypto from "node:crypto";
import { PoolClient } from "pg";
import { query, transaction } from "./db";
import { booking } from "./format";
import { ApiResult, Booking } from "./types";

const APP_LOCK = 294_817; // Serializes reset, booking and cancellation across server instances.
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const fingerprint = (body: unknown) => crypto.createHash("sha256").update(stableJson(body)).digest("hex");
const response = (status: number, body: ApiResult["body"], headers?: Record<string, string>): ApiResult => ({ status, body, headers });

async function rateLimit(client: PoolClient, email: string): Promise<ApiResult | null> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [email]);
  const count = await client.query<{ count: string; oldest: Date }>("SELECT count(*)::text, min(attempted_at) AS oldest FROM booking_attempts WHERE email = $1 AND attempted_at > now() - interval '60 seconds'", [email]);
  if (Number(count.rows[0].count) >= 5) {
    const oldest = new Date(count.rows[0].oldest).getTime();
    const retry = Math.max(1, Math.ceil((oldest + 60_000 - Date.now()) / 1000));
    return response(429, { error: "Too many booking attempts. Try again later." }, { "Retry-After": String(retry) });
  }
  await client.query("INSERT INTO booking_attempts(email) VALUES ($1)", [email]);
  return null;
}

async function saveIdempotency(client: PoolClient, key: string | null, hash: string, result: ApiResult) {
  if (key) await client.query("INSERT INTO idempotency_records(key, fingerprint, response_status, response_body) VALUES ($1, $2, $3, $4::jsonb)", [key, hash, result.status, JSON.stringify(result.body)]);
}

async function replayIdempotency(client: PoolClient, key: string | null, hash: string): Promise<ApiResult | null> {
  if (!key) return null;
  const prior = await client.query<{ fingerprint: string; response_status: number; response_body: ApiResult["body"] }>("SELECT fingerprint, response_status, response_body FROM idempotency_records WHERE key = $1", [key]);
  if (!prior.rowCount) return null;
  const record = prior.rows[0];
  return record.fingerprint === hash
    ? response(record.response_status, record.response_body, record.response_status === 429 ? { "Retry-After": "1" } : undefined)
    : response(422, { error: "Idempotency-Key was reused with a different request." });
}

export async function rejectInvalidBooking(body: unknown, email: string | null, idempotencyKey: string | null): Promise<ApiResult> {
  const hash = fingerprint(body);
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [APP_LOCK]);
    const replay = await replayIdempotency(client, idempotencyKey, hash);
    if (replay) return replay;
    const result = email ? await rateLimit(client, email) ?? response(400, { error: "Invalid booking request" }) : response(400, { error: "Invalid booking request" });
    await saveIdempotency(client, idempotencyKey, hash, result);
    return result;
  });
}

export async function createBooking(input: { slot_id: string; name: string; email: string }, idempotencyKey: string | null, requestBody: unknown = input): Promise<ApiResult> {
  const hash = fingerprint(requestBody);
  try {
    return await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [APP_LOCK]);
      const replay = await replayIdempotency(client, idempotencyKey, hash);
      if (replay) return replay;
      const limited = await rateLimit(client, input.email);
      if (limited) { await saveIdempotency(client, idempotencyKey, hash, limited); return limited; }
      const slot = await client.query<{ id: string; start: Date }>("SELECT id, start FROM slots WHERE id = $1 FOR UPDATE", [input.slot_id]);
      let result: ApiResult;
      if (!slot.rowCount) result = response(404, { error: "Slot not found" });
      else if (new Date(slot.rows[0].start) <= new Date()) result = response(400, { error: "Slot has already started" });
      else {
        const existing = await client.query("SELECT 1 FROM bookings WHERE slot_id = $1 AND status = 'confirmed'", [input.slot_id]);
        if (existing.rowCount) result = response(409, { error: "Slot is already booked" });
        else {
          const inserted = await client.query("INSERT INTO bookings(id, slot_id, name, email, status) VALUES ($1, $2, $3, $4, 'confirmed') RETURNING id, slot_id, name, email, status, created_at", [crypto.randomUUID(), input.slot_id, input.name, input.email]);
          result = response(201, booking(inserted.rows[0]));
        }
      }
      await saveIdempotency(client, idempotencyKey, hash, result);
      return result;
    });
  } catch (cause: unknown) {
    // A partial unique-index violation is a final safety net if a deployment changes locking.
    if ((cause as { code?: string }).code === "23505") return response(409, { error: "Slot is already booked" });
    throw cause;
  }
}

export async function getBooking(id: string): Promise<Booking | null> {
  const result = await query("SELECT id, slot_id, name, email, status, created_at FROM bookings WHERE id = $1", [id]);
  return result.rowCount ? booking(result.rows[0]) : null;
}

export async function cancelBooking(id: string): Promise<ApiResult> {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [APP_LOCK]);
    const updated = await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = 'confirmed' RETURNING id, slot_id, name, email, status, created_at", [id]);
    if (updated.rowCount) return response(200, booking(updated.rows[0]));
    const exists = await client.query("SELECT 1 FROM bookings WHERE id = $1", [id]);
    return exists.rowCount ? response(409, { error: "Booking is already cancelled" }) : response(404, { error: "Booking not found" });
  });
}
