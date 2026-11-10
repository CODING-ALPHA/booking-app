import { requireApiKey } from "@/lib/auth";
import { cancelBooking, getBooking } from "@/lib/bookings";
import { error, json } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { const unauthorized = requireApiKey(request); if (unauthorized) return unauthorized; try { const found = await getBooking((await params).id); return found ? json(found) : error("Booking not found", 404); } catch { return error("Internal server error", 500); } }
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) { const unauthorized = requireApiKey(request); if (unauthorized) return unauthorized; try { const result = await cancelBooking((await params).id); return json(result.body, result.status); } catch { return error("Internal server error", 500); } }
