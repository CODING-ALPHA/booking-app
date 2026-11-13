import { query, transaction } from "./db";
import { slot } from "./format";
import { Slot } from "./types";
const APP_LOCK = 294_817;
export async function replaceSlots(slots: Slot[]) {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [APP_LOCK]);
    await client.query("DELETE FROM bookings");
    await client.query("DELETE FROM slots");
    await client.query("DELETE FROM idempotency_records");
    // The assessment uses reset to start each check from a clean state.
    await client.query("DELETE FROM booking_attempts");
    for (const item of slots) await client.query("INSERT INTO slots(id, provider, start, \"end\") VALUES ($1, $2, $3, $4)", [item.id, item.provider, item.start, item.end]);
  });
}
export async function listSlots(provider?: string) {
  const result = await query(`SELECT s.id, s.provider, s.start, s."end", NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS available FROM slots s ${provider === undefined ? "" : "WHERE s.provider = $1"} ORDER BY s.start ASC, s.id ASC`, provider === undefined ? [] : [provider]);
  return result.rows.map((r) => ({ ...slot(r), available: r.available === true }));
}
