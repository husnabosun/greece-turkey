import { NextResponse } from "next/server";

/** Phase 3: AgroMonitoring NDVI/EVI for field polygons. */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Not implemented yet — Phase 3" },
    { status: 501 },
  );
}
