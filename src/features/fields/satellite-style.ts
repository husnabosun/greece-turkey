import type { StyleSpecification } from "mapbox-gl";

/**
 * True satellite basemap without Mapbox raster tiles.
 * Mapbox free-tier was returning 429 on mapbox.satellite.
 * Esri World Imagery serves real orthophoto tiles (Mapbox GL still needs a token for the JS SDK).
 */
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: "AgroPulse Satellite",
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxzoom: 19,
    },
    // Place / road names on top of imagery (no Mapbox vector tiles → avoids 429).
    "esri-boundaries-places": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri Reference",
      maxzoom: 19,
    },
    "esri-reference-overlay": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Reference_Overlay/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri Reference",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster",
      source: "esri-world-imagery",
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: "esri-boundaries-places",
      type: "raster",
      source: "esri-boundaries-places",
      minzoom: 0,
      maxzoom: 22,
      paint: { "raster-opacity": 0.95 },
    },
    {
      id: "esri-reference-overlay",
      type: "raster",
      source: "esri-reference-overlay",
      minzoom: 0,
      maxzoom: 22,
      paint: { "raster-opacity": 0.9 },
    },
  ],
};

/** Mainland Greece fallback (near Athens) — never default to Türkiye. */
export const DEFAULT_FIELD_CENTER: [number, number] = [23.7275, 37.9838];
/** Wide enough to see city / region before device location resolves. */
export const DEFAULT_FIELD_ZOOM = 11;

export type FieldPolygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};

/** Best-effort parse of PostGIS/GeoJSON geometry coming from Supabase. */
export function parseFieldPolygon(geom: unknown): FieldPolygon | null {
  if (!geom) return null;

  let value: unknown = geom;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") return null;
  const obj = value as { type?: string; coordinates?: unknown; geometry?: { type?: string; coordinates?: unknown } };

  if (obj.type === "Feature" && obj.geometry?.type === "Polygon" && Array.isArray(obj.geometry.coordinates)) {
    return { type: "Polygon", coordinates: obj.geometry.coordinates as [number, number][][] };
  }

  if (obj.type === "Polygon" && Array.isArray(obj.coordinates)) {
    return { type: "Polygon", coordinates: obj.coordinates as [number, number][][] };
  }

  if (obj.type === "MultiPolygon" && Array.isArray(obj.coordinates)) {
    const first = (obj.coordinates as [number, number][][][])[0];
    if (first) return { type: "Polygon", coordinates: first };
  }

  return null;
}

export function boundsFromPolygon(polygon: FieldPolygon): [[number, number], [number, number]] | null {
  const ring = polygon.coordinates[0];
  if (!ring?.length) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}
