import { getServerEnv } from "@/core/config/env";

const BASE = "http://api.agromonitoring.com/agro/1.0";

export type NdviPoint = {
  dt: number;
  /** Mean NDVI for the polygon that day. */
  mean: number | null;
  min: number | null;
  max: number | null;
  source: string | null;
};

export type NdviResult = {
  polygonId: string;
  areaHa: number | null;
  points: NdviPoint[];
  source: "agromonitoring" | "demo";
};

type AgroPolygon = {
  id: string;
  area?: number;
};

function demoNdvi(): NdviResult {
  const now = Math.floor(Date.now() / 1000);
  const day = 86_400;
  return {
    polygonId: "demo",
    areaHa: null,
    source: "demo",
    points: [0, 1, 2, 3, 4].map((i) => ({
      dt: now - i * 8 * day,
      mean: 0.62 - i * 0.02,
      min: 0.4,
      max: 0.78,
      source: "demo",
    })),
  };
}

/** Create (or reuse) an AgroMonitoring polygon and fetch NDVI history. */
export async function fetchNdviHistory(args: {
  name: string;
  coordinates: number[][][];
  start?: number;
  end?: number;
}): Promise<NdviResult> {
  const { AGROMONITORING_API_KEY } = getServerEnv();
  if (!AGROMONITORING_API_KEY) return demoNdvi();

  const end = args.end ?? Math.floor(Date.now() / 1000);
  const start = args.start ?? end - 60 * 86_400;

  try {
    const createRes = await fetch(`${BASE}/polygons?appid=${AGROMONITORING_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: args.name.slice(0, 80),
        geo_json: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: args.coordinates },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!createRes.ok) return demoNdvi();
    const polygon = (await createRes.json()) as AgroPolygon;
    if (!polygon.id) return demoNdvi();

    const histRes = await fetch(
      `${BASE}/ndvi/history?polyid=${encodeURIComponent(polygon.id)}&start=${start}&end=${end}&appid=${AGROMONITORING_API_KEY}`,
      { signal: AbortSignal.timeout(20_000) },
    );

    if (!histRes.ok) {
      return {
        polygonId: polygon.id,
        areaHa: typeof polygon.area === "number" ? polygon.area : null,
        points: [],
        source: "agromonitoring",
      };
    }

    const raw = (await histRes.json()) as Array<{
      dt: number;
      data?: { mean?: number; min?: number; max?: number };
      source?: string;
    }>;

    return {
      polygonId: polygon.id,
      areaHa: typeof polygon.area === "number" ? polygon.area : null,
      source: "agromonitoring",
      points: (Array.isArray(raw) ? raw : []).map((row) => ({
        dt: row.dt,
        mean: row.data?.mean ?? null,
        min: row.data?.min ?? null,
        max: row.data?.max ?? null,
        source: row.source ?? null,
      })),
    };
  } catch {
    return demoNdvi();
  }
}
