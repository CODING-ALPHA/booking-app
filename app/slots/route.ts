import { requireApiKey } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { listSlots } from "@/lib/slots";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const unauthorized = requireApiKey(request); if (unauthorized) return unauthorized;
  try { return json({ slots: await listSlots(new URL(request.url).searchParams.get("provider") ?? undefined) }); } catch { return error("Internal server error", 500); }
}
