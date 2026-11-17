import { publicEnv } from "@/core/config/env";

type MapboxContext = { id: string; text: string };
type MapboxFeature = {
  text?: string;
  place_name?: string;
  context?: MapboxContext[];
};

/**
 * Reverse-geocode lat/lon via Mapbox → "Town, Province" (demo: Germencik, Aydın).
 * Returns null when token/coords/API unavailable.
 */
export async function reverseGeocodePlace(
  lat: number,
  lon: number,
  locale: string,
): Promise<string | null> {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const language = locale.startsWith("tr") ? "tr" : locale.startsWith("el") ? "el" : "en";
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json` +
    `?access_token=${encodeURIComponent(token)}` +
    `&language=${language}&types=place,locality,region,district&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: MapboxFeature[] };
    const feature = data.features?.[0];
    if (!feature) return null;
    return formatPlace(feature);
  } catch {
    return null;
  }
}

function formatPlace(feature: MapboxFeature): string | null {
  const town = feature.text?.trim();
  const ctx = feature.context ?? [];
  const region =
    ctx.find((c) => c.id.startsWith("region."))?.text?.trim() ||
    ctx.find((c) => c.id.startsWith("district."))?.text?.trim() ||
    ctx.find((c) => c.id.startsWith("place."))?.text?.trim();

  if (town && region && region !== town) return `${town}, ${region}`;
  if (town) return town;

  const parts = (feature.place_name ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return parts[0] ?? null;
}
