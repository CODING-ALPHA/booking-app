import { NextResponse } from "next/server";
export const json = (body: unknown, status = 200, headers?: HeadersInit) => NextResponse.json(body, { status, headers });
export const error = (message: string, status: number, headers?: HeadersInit) => json({ error: message }, status, headers);
