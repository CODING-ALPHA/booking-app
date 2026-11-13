import { createBooking, rejectInvalidBooking } from "@/lib/bookings";
import { error, json } from "@/lib/http";
import { bookingSchema, normalizeEmail, readJson } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) { const raw = await readJson(request), parsed = bookingSchema.safeParse(raw); if (!parsed.success) { try { const email = normalizeEmail((raw as { email?: unknown } | undefined)?.email); const result = await rejectInvalidBooking(raw, email, request.headers.get("idempotency-key")); return json(result.body, result.status, result.headers); } catch { return error("Unable to book right now.", 500); } } try { const result = await createBooking(parsed.data, request.headers.get("idempotency-key"), raw); return json(result.body, result.status, result.headers); } catch { return error("Unable to book right now.", 500); } }
