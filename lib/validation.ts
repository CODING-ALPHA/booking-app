import { z } from "zod";
export const slotSchema = z.object({ id: z.string().min(1), provider: z.string().min(1), start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }) }).refine((s) => new Date(s.end) > new Date(s.start), { message: "slot end must be after start" });
export const resetSchema = z.object({ slots: z.array(slotSchema) }).refine(
  ({ slots }) => new Set(slots.map((slot) => slot.id)).size === slots.length,
  { message: "slot ids must be unique" },
);
export const isBookingId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const bookingSchema = z.object({ slot_id: z.string().trim().min(1), name: z.string().trim().min(1), email: z.string().trim().email() }).transform((v) => ({ ...v, email: v.email.toLowerCase() }));
export const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : null;
export async function readJson(request: Request): Promise<unknown> { try { return await request.json(); } catch { return undefined; } }
