import { createBooking, recordFailedAttempt } from "@/lib/bookings";
import { error, json } from "@/lib/http";
import { bookingSchema, normalizeEmail, readJson } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) { const raw = await readJson(request), parsed = bookingSchema.safeParse(raw); if (!parsed.success) { const email = normalizeEmail((raw as { email?: unknown } | undefined)?.email); if (email) { try { const limited = await recordFailedAttempt(email); if (limited) return json(limited.body, limited.status, limited.headers); } catch { return error("Unable to book right now.", 500); } } return error("Please enter a valid name and email.", 400); } try { const result = await createBooking(parsed.data, null); return json(result.body, result.status, result.headers); } catch { return error("Unable to book right now.", 500); } }
