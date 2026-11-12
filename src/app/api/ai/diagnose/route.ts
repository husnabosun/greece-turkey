import { NextResponse } from "next/server";

/** Phase 3: Gemini 2.5 Flash multimodal leaf/fruit diagnosis. */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Not implemented yet — Phase 3" },
    { status: 501 },
  );
}
