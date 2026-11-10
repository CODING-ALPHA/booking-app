import { error, json } from "@/lib/http";
import { listSlots } from "@/lib/slots";
export const runtime = "nodejs";
export async function GET(request: Request) { try { return json({ slots: await listSlots(new URL(request.url).searchParams.get("provider") ?? undefined) }); } catch { return error("Service unavailable", 503); } }
