import { requireApiKey } from "@/lib/auth";
import { cancelBooking, getBooking } from "@/lib/bookings";
import { error, json } from "@/lib/http";
import { isBookingId } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!isBookingId(id)) return error("Booking not found", 404);
  try {
    const found = await getBooking(id);
    return found ? json(found) : error("Booking not found", 404);
  } catch { return error("Internal server error", 500); }
}

export async function DELETE(request: Request, { params }: Context) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!isBookingId(id)) return error("Booking not found", 404);
  try {
    const result = await cancelBooking(id);
    return json(result.body, result.status);
  } catch { return error("Internal server error", 500); }
}
