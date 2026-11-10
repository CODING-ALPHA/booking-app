import { error } from "./http";
export function requireApiKey(request: Request) {
  const key = process.env.API_KEY;
  if (!key || request.headers.get("x-api-key") !== key) return error("Unauthorized", 401);
  return null;
}
