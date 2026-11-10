import { z } from "zod";
export const slotSchema = z.object({ id: z.string().min(1), provider: z.string().min(1), start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }) }).refine((s) => new Date(s.end) > new Date(s.start), { message: "slot end must be after start" });
export const resetSchema = z.object({ slots: z.array(slotSchema) });
export const bookingSchema = z.object({ slot_id: z.string().trim().min(1), name: z.string().trim().min(1), email: z.string().trim().email() }).transform((v) => ({ ...v, email: v.email.toLowerCase() }));
export const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : null;
export async function readJson(request: Request): Promise<unknown> { try { return await request.json(); } catch { return undefined; } }
