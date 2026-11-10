import { requireApiKey } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { replaceSlots } from "@/lib/slots";
import { readJson, resetSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const unauthorized = requireApiKey(request); if (unauthorized) return unauthorized;
  const parsed = resetSchema.safeParse(await readJson(request));
  if (!parsed.success) return error("Invalid reset payload", 400);
  try { await replaceSlots(parsed.data.slots); return json({}); } catch { return error("Internal server error", 500); }
}
