import sharp from "sharp";
import { geminiJsonDetailed, hasGeminiKey } from "@/features/diagnostics/gemini";
import { applyAgronomicGuardrail } from "@/features/fields/olive-density";
import { treeCountAiResult } from "@/features/fields/count-trees-schema";
import { boundsFromPolygon, type FieldPolygon } from "@/features/fields/satellite-style";

const ESRI_EXPORT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";

/** Full-field export before 2×2 slice (keeps crowns readable, token cost low). */
const EXPORT_PX = 1024;
const QUAD_PX = 512;
const PAD_FRAC = 0.02;

export type CountTreesOutcome =
  | {
      ok: true;
      treeCount: number;
      confidence: number;
      source: "gemini" | "agronomic";
      tiles: number;
      rawCount: number;
      adjusted: boolean;
    }
  | { ok: false; reason: "no_key" | "bad_polygon" | "imagery" | "ai" | "empty"; detail?: string };

type BBox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

/** Count olive crowns: Esri snapshot → mask/sharpen → 2×2 Gemini → agronomic guardrail. */
export async function countTreesFromSatellite(polygon: FieldPolygon): Promise<CountTreesOutcome> {
  if (!hasGeminiKey()) return { ok: false, reason: "no_key" };

  const bounds = boundsFromPolygon(polygon);
  if (!bounds) return { ok: false, reason: "bad_polygon" };

  const [[minLon0, minLat0], [maxLon0, maxLat0]] = bounds;
  const padLon = (maxLon0 - minLon0) * PAD_FRAC || 0.00004;
  const padLat = (maxLat0 - minLat0) * PAD_FRAC || 0.00004;
  const bbox: BBox = {
    minLon: minLon0 - padLon,
    minLat: minLat0 - padLat,
    maxLon: maxLon0 + padLon,
    maxLat: maxLat0 + padLat,
  };

  const areaHa = polygonAreaHa(polygon.coordinates[0] ?? []);
  if (areaHa <= 0) return { ok: false, reason: "bad_polygon", detail: "empty area" };

  const rawPng = await fetchEsriExport(bbox, EXPORT_PX, EXPORT_PX);
  if (!rawPng) return { ok: false, reason: "imagery", detail: "esri export failed" };

  let quads: Buffer[];
  try {
    const masked = await maskContrastAndSharpen(rawPng, polygon, bbox, EXPORT_PX, EXPORT_PX);
    quads = await slice2x2(masked, EXPORT_PX, QUAD_PX);
  } catch (err) {
    return {
      ok: false,
      reason: "imagery",
      detail: err instanceof Error ? err.message : "preprocess failed",
    };
  }

  const counted = await Promise.all(
    quads.map((buf, i) => countQuad(buf.toString("base64"), i)),
  );

  const okTiles = counted.filter((c): c is { ok: true; count: number; confidence: number } => c.ok);
  if (!okTiles.length) {
    const firstFail = counted.find((c) => !c.ok);
    return {
      ok: false,
      reason: "ai",
      detail: firstFail && !firstFail.ok ? firstFail.detail : "all tiles failed",
    };
  }

  const rawCount = okTiles.reduce((s, t) => s + t.count, 0);
  const confidence = okTiles.reduce((s, t) => s + t.confidence, 0) / okTiles.length;
  const guard = applyAgronomicGuardrail(rawCount, areaHa);

  return {
    ok: true,
    treeCount: guard.treeCount,
    confidence: guard.adjusted ? Math.min(confidence, 0.55) : confidence,
    source: guard.adjusted ? "agronomic" : "gemini",
    tiles: okTiles.length,
    rawCount: Math.round(rawCount),
    adjusted: guard.adjusted,
  };
}

/** Map polygon ring into pixel coords for an export image (y=0 at north). */
export function polygonToPixelRing(
  polygon: FieldPolygon,
  bbox: BBox,
  width: number,
  height: number,
): Array<[number, number]> {
  const ring = polygon.coordinates[0];
  if (!ring?.length) return [];
  const lonSpan = bbox.maxLon - bbox.minLon || 1;
  const latSpan = bbox.maxLat - bbox.minLat || 1;
  const out: Array<[number, number]> = [];
  for (const [lon, lat] of ring) {
    const x = ((lon - bbox.minLon) / lonSpan) * width;
    const y = ((bbox.maxLat - lat) / latSpan) * height;
    out.push([x, y]);
  }
  return out;
}

/** Black outside the field, boost crown contrast, mild sharpen. */
export async function maskContrastAndSharpen(
  png: Buffer,
  polygon: FieldPolygon,
  bbox: BBox,
  width: number,
  height: number,
): Promise<Buffer> {
  const pts = polygonToPixelRing(polygon, bbox, width, height);
  if (pts.length < 3) throw new Error("polygon too small for mask");

  const pointsAttr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" fill="black"/>` +
      `<polygon points="${pointsAttr}" fill="white"/>` +
      `</svg>`,
  );

  const maskPng = await sharp(maskSvg).png().toBuffer();

  return sharp(png)
    .resize(width, height, { fit: "fill" })
    .composite([{ input: maskPng, blend: "dest-in" }])
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    // Lift midtones / contrast so dark olive crowns separate from soil.
    .linear(1.28, -(128 * 0.28))
    .modulate({ brightness: 1.04, saturation: 1.08 })
    .sharpen({ sigma: 1.1, m1: 1.0, m2: 0.6 })
    .png()
    .toBuffer();
}

/** Split a square masked image into four 512×512 quadrants. */
export async function slice2x2(png: Buffer, fullPx: number, quadPx: number): Promise<Buffer[]> {
  const base = sharp(png).resize(fullPx, fullPx, { fit: "fill" });
  const origins: Array<[number, number]> = [
    [0, 0],
    [quadPx, 0],
    [0, quadPx],
    [quadPx, quadPx],
  ];
  return Promise.all(
    origins.map(([left, top]) =>
      base
        .clone()
        .extract({ left, top, width: quadPx, height: quadPx })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer(),
    ),
  );
}

async function fetchEsriExport(bbox: BBox, width: number, height: number): Promise<Buffer | null> {
  const url =
    `${ESRI_EXPORT}?bbox=${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}` +
    `&bboxSR=4326&imageSR=4326&size=${width},${height}&format=png&f=image&transparent=false`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "image/png,image/*" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 800) return null;
    return buf;
  } catch {
    return null;
  }
}

async function countQuad(
  imageBase64: string,
  index: number,
): Promise<{ ok: true; count: number; confidence: number } | { ok: false; detail?: string }> {
  const prompt = `You are counting olive tree crowns in ONE quadrant of a masked satellite orthophoto (Greek/Turkish grove).

Image notes:
- Outside the drawn field is BLACK — ignore black areas completely.
- Count DISTINCT dark-green / grey-green CROWN centers (round/oval canopy blobs) on the visible ground.
- Do NOT estimate from area or density. Count what you see.
- Skip roads, buildings, lone bushes that are clearly not orchard trees, and anything in black.
- If two crowns touch, count both when two centers are visible.
- This is quadrant ${index + 1} of 4 — only count trees in THIS image.

Return JSON only: {"count": <integer>}`;

  const result = await geminiJsonDetailed({
    prompt,
    schema: treeCountAiResult,
    imageBase64: `data:image/jpeg;base64,${imageBase64}`,
    temperature: 0,
    timeoutMs: 55_000,
  });

  if (!result.ok) return { ok: false, detail: result.detail ?? result.reason };
  return { ok: true, count: result.data.count, confidence: result.data.confidence };
}

/** Spherical excess approximation for small polygons (ha). */
export function polygonAreaHa(ring: [number, number][] | undefined): number {
  if (!ring || ring.length < 3) return 0;
  const R = 6378137;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i]!;
    const [lon2, lat2] = ring[i + 1]!;
    total +=
      ((lon2 * Math.PI) / 180 - (lon1 * Math.PI) / 180) *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  const areaM2 = Math.abs((total * R * R) / 2);
  return areaM2 / 10_000;
}
