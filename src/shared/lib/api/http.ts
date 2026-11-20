import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; details?: unknown };

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data } satisfies ApiOk<T>, init);
}

export function jsonError(error: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error, details } satisfies ApiErr, { status });
}

export function fromZodError(err: ZodError) {
  return jsonError("Invalid request", 400, err.flatten());
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
