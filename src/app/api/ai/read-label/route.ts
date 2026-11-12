import { NextResponse } from "next/server";

/** Phase 3: Gemini label OCR + EU compliance draft. */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Not implemented yet — Phase 3" },
    { status: 501 },
  );
}
