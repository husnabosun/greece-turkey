import { NextResponse } from "next/server";

/** Phase 3: Open-Meteo proxy & cache. */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Not implemented yet — Phase 3" },
    { status: 501 },
  );
}
