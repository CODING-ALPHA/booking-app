import { requireApiKey } from "@/lib/auth";
import { createBooking, recordFailedAttempt } from "@/lib/bookings";
import { query } from "@/lib/db";
import { booking } from "@/lib/format";
import { error, json } from "@/lib/http";
import { normalizeEmail, bookingSchema, readJson } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const unauthorized = requireApiKey(request); if (unauthorized) return unauthorized;
  const raw = await readJson(request), parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) { const email = normalizeEmail((raw as { email?: unknown } | undefined)?.email); if (email) { try { const limited = await recordFailedAttempt(email); if (limited) return json(limited.body, limited.status, limited.headers); } catch { return error("Internal server error", 500); } } return error("Invalid booking request", 400); }
  try { const result = await createBooking(parsed.data, request.headers.get("idempotency-key")); return json(result.body, result.status, result.headers); } catch { return error("Internal server error", 500); }
}
function decodeCursor(cursor: string) { try { const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")); return typeof value.created_at === "string" && typeof value.id === "string" ? value : null; } catch { return null; } }
export async function GET(request: Request) {
  const unauthorized = requireApiKey(request); if (unauthorized) return unauthorized;
  const params = new URL(request.url).searchParams, email = normalizeEmail(params.get("email"));
  if (!email) return error("email is required", 400);
  const rawLimit = params.get("limit"), limit = rawLimit === null ? 10 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return error("limit must be an integer from 1 to 50", 400);
  const cursor = params.get("cursor"), decoded = cursor ? decodeCursor(cursor) : null;
  if (cursor && !decoded) return error("Invalid cursor", 400);
  try {
    const values: unknown[] = [email]; let where = "email = $1";
    if (decoded) { values.push(decoded.created_at, decoded.id); where += " AND (created_at, id) > ($2::timestamptz, $3::uuid)"; }
    values.push(limit + 1);
    const rows = await query(`SELECT id, slot_id, name, email, status, created_at FROM bookings WHERE ${where} ORDER BY created_at ASC, id ASC LIMIT $${values.length}`, values);
    const hasMore = rows.rows.length > limit, items = rows.rows.slice(0, limit).map(booking), last = items.at(-1);
    return json({ bookings: items, next_cursor: hasMore && last ? Buffer.from(JSON.stringify({ created_at: last.created_at, id: last.id })).toString("base64url") : null });
  } catch { return error("Internal server error", 500); }
}
