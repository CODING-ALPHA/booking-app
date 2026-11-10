export type Status = "confirmed" | "cancelled";
export type Booking = { id: string; slot_id: string; name: string; email: string; status: Status; created_at: string };
export type Slot = { id: string; provider: string; start: string; end: string };
export type ApiResult = { status: number; body: Booking | { error: string }; headers?: Record<string, string> };
