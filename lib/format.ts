import { Booking, Slot } from "./types";
export function booking(row: Record<string, unknown>): Booking { return { id: String(row.id), slot_id: String(row.slot_id), name: String(row.name), email: String(row.email), status: row.status as Booking["status"], created_at: new Date(String(row.created_at)).toISOString() }; }
export function slot(row: Record<string, unknown>): Slot { return { id: String(row.id), provider: String(row.provider), start: new Date(String(row.start)).toISOString(), end: new Date(String(row.end)).toISOString() }; }
