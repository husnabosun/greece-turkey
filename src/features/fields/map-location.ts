import { DEFAULT_FIELD_CENTER, DEFAULT_FIELD_ZOOM } from "@/features/fields/satellite-style";

const STORAGE_KEY = "agropulse:last-map-center";

export type MapCenter = {
  center: [number, number];
  zoom: number;
};

/** Zoom after device geolocation — still wide enough to orient. */
export const LOCATE_ZOOM = 12.5;

/** Closer zoom when the user taps “use my location” to draw. */
export const DRAW_LOCATE_ZOOM = 14;

export function readLastMapCenter(): MapCenter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lon?: unknown; lat?: unknown; zoom?: unknown };
    const lon = Number(parsed.lon);
    const lat = Number(parsed.lat);
    const zoom = Number(parsed.zoom);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return {
      center: [lon, lat],
      zoom: Number.isFinite(zoom) ? zoom : DEFAULT_FIELD_ZOOM,
    };
  } catch {
    return null;
  }
}

export function writeLastMapCenter(lon: number, lat: number, zoom = LOCATE_ZOOM) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lon, lat, zoom }));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Prefer last saved device location, else Greece mainland fallback. */
export function initialMapView(): MapCenter {
  return readLastMapCenter() ?? { center: DEFAULT_FIELD_CENTER, zoom: DEFAULT_FIELD_ZOOM };
}

export function requestDeviceLocation(opts?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 120_000,
      ...opts,
    });
  });
}
