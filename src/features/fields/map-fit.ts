import {
  boundsFromPolygon,
  parseFieldPolygon,
} from "@/features/fields/satellite-style";

export type LngLatBoundsTuple = [[number, number], [number, number]];

export type FitPoint = { lat?: number | null; lon?: number | null };

function validPoint(p: FitPoint): p is { lat: number; lon: number } {
  return (
    p.lat != null &&
    p.lon != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lon) <= 180
  );
}

function union(boxes: LngLatBoundsTuple[]): LngLatBoundsTuple | null {
  if (!boxes.length) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [[a, b], [c, d]] of boxes) {
    minLon = Math.min(minLon, a);
    minLat = Math.min(minLat, b);
    maxLon = Math.max(maxLon, c);
    maxLat = Math.max(maxLat, d);
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/**
 * What the map should frame on load: the selected field polygon, else every field polygon ("all"),
 * else the lat/lon pins of those fields. Returns null when nothing is locatable (caller keeps its view).
 */
export function fitBoundsFor(input: {
  geom?: unknown;
  outlines?: { geom: unknown }[];
  points?: FitPoint[];
  lat?: number | null;
  lon?: number | null;
}): LngLatBoundsTuple | null {
  const boxes: LngLatBoundsTuple[] = [];
  const multi = Boolean(input.outlines?.length);

  if (multi) {
    for (const o of input.outlines!) {
      const poly = parseFieldPolygon(o.geom);
      const b = poly ? boundsFromPolygon(poly) : null;
      if (b) boxes.push(b);
    }
  } else {
    const poly = parseFieldPolygon(input.geom);
    const b = poly ? boundsFromPolygon(poly) : null;
    if (b) boxes.push(b);
  }

  if (!boxes.length) {
    const pts: FitPoint[] = multi ? (input.points ?? []) : [{ lat: input.lat, lon: input.lon }];
    for (const p of pts) {
      if (validPoint(p)) boxes.push([[p.lon, p.lat], [p.lon, p.lat]]);
    }
  }
  return union(boxes);
}

/**
 * Frame used to place relative (0-100) tree dots. Uses the drawn polygon; when a field only has a pin,
 * a square of the field area (default 1 ha) centred on it, so tree dots still show.
 */
export function treeFrameBounds(input: {
  geom?: unknown;
  lat?: number | null;
  lon?: number | null;
  areaHa?: number | null;
}): LngLatBoundsTuple | null {
  const poly = parseFieldPolygon(input.geom);
  const b = poly ? boundsFromPolygon(poly) : null;
  if (b) return b;
  const pt = { lat: input.lat, lon: input.lon };
  if (!validPoint(pt)) return null;
  const ha = input.areaHa != null && Number.isFinite(input.areaHa) && input.areaHa > 0 ? input.areaHa : 1;
  const sideM = Math.sqrt(ha * 10_000);
  const dLat = sideM / 2 / 111_320;
  const dLon = sideM / 2 / (111_320 * Math.max(0.2, Math.cos((pt.lat * Math.PI) / 180)));
  return [
    [pt.lon - dLon, pt.lat - dLat],
    [pt.lon + dLon, pt.lat + dLat],
  ];
}
