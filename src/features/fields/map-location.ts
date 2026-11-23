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

/** Give up locating after this long. */
export const LOCATE_TIMEOUT_MS = 8000;

/** Coarse (network / cell) fix is enough to centre a map and answers much faster than GPS. */
export const LOCATE_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: LOCATE_TIMEOUT_MS,
  maximumAge: 120_000,
};

export type LocationFailure = "denied" | "unavailable" | "timeout";

export type LocationResult =
  | { ok: true; position: GeolocationPosition }
  | { ok: false; reason: LocationFailure };

/** Message key in the `common` namespace for each failure. */
export const LOCATION_FAILURE_MESSAGE_KEY = {
  denied: "locateDenied",
  unavailable: "locateUnavailable",
  timeout: "locateTimeout",
} as const satisfies Record<LocationFailure, string>;

/** GeolocationPositionError.code: 1 = permission denied, 2 = position unavailable, 3 = timeout. */
export function classifyLocationError(err: unknown): LocationFailure {
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

function currentGeolocation(): Geolocation | undefined {
  return typeof navigator !== "undefined" ? navigator.geolocation : undefined;
}

/**
 * Ask for the device position. Never throws or rejects: a refusal, a missing API, a timeout or any
 * other failure comes back as `{ ok: false, reason }` so the caller can keep the current map view.
 */
export function locateDevice(
  opts?: PositionOptions,
  geo: Geolocation | undefined = currentGeolocation(),
): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!geo) {
      resolve({ ok: false, reason: "unavailable" });
      return;
    }
    // Some browsers never call back (permission prompt ignored): our own timer guarantees an answer.
    const timer = setTimeout(() => resolve({ ok: false, reason: "timeout" }), LOCATE_TIMEOUT_MS + 2000);
    const done = (r: LocationResult) => {
      clearTimeout(timer);
      resolve(r);
    };
    try {
      geo.getCurrentPosition(
        (position) => done({ ok: true, position }),
        (err) => done({ ok: false, reason: classifyLocationError(err) }),
        { ...LOCATE_OPTIONS, ...opts },
      );
    } catch (err) {
      done({ ok: false, reason: classifyLocationError(err) });
    }
  });
}

/** Rejecting variant, kept for callers that already wrap it in try/catch. Prefer `locateDevice`. */
export async function requestDeviceLocation(opts?: PositionOptions): Promise<GeolocationPosition> {
  const r = await locateDevice(opts);
  if (!r.ok) throw new Error(`geolocation ${r.reason}`);
  return r.position;
}

/**
 * True only when the browser already granted geolocation to this site, so we can centre the map on the
 * device without showing a permission prompt on page load. Never throws; an unknown / unsupported
 * Permissions API counts as "not granted".
 */
export async function isGeolocationGranted(
  permissions: Pick<Permissions, "query"> | undefined = typeof navigator !== "undefined" ? navigator.permissions : undefined,
): Promise<boolean> {
  if (!permissions) return false;
  try {
    const status = await permissions.query({ name: "geolocation" as PermissionName });
    return status.state === "granted";
  } catch {
    return false;
  }
}
