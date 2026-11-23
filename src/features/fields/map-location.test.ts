import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCATE_OPTIONS,
  LOCATE_TIMEOUT_MS,
  LOCATION_FAILURE_MESSAGE_KEY,
  classifyLocationError,
  isGeolocationGranted,
  locateDevice,
  requestDeviceLocation,
} from "@/features/fields/map-location";
import { LOCALES, flattenMessages, loadMessages } from "@/shared/i18n/audit-helpers";

const position = { coords: { latitude: 39.3, longitude: 26.7 } } as GeolocationPosition;

/** A fake navigator.geolocation that answers with `behave`. */
function fakeGeo(behave: (ok: PositionCallback, fail: PositionErrorCallback, opts?: PositionOptions) => void) {
  const getCurrentPosition = vi.fn(behave);
  return { geo: { getCurrentPosition } as unknown as Geolocation, getCurrentPosition };
}

const err = (code: number) => ({ code, message: "x" }) as GeolocationPositionError;

afterEach(() => vi.useRealTimers());

describe("classifyLocationError", () => {
  it("maps the Geolocation error codes", () => {
    expect(classifyLocationError(err(1))).toBe("denied");
    expect(classifyLocationError(err(2))).toBe("unavailable");
    expect(classifyLocationError(err(3))).toBe("timeout");
  });

  it("treats anything else as unavailable", () => {
    expect(classifyLocationError(new Error("boom"))).toBe("unavailable");
    expect(classifyLocationError(null)).toBe("unavailable");
    expect(classifyLocationError(undefined)).toBe("unavailable");
    expect(classifyLocationError("denied")).toBe("unavailable");
  });
});

describe("locateDevice never throws", () => {
  it("returns the position on success", async () => {
    const { geo } = fakeGeo((ok) => ok(position));
    expect(await locateDevice(undefined, geo)).toEqual({ ok: true, position });
  });

  it("denied", async () => {
    const { geo } = fakeGeo((_ok, fail) => fail(err(1)));
    expect(await locateDevice(undefined, geo)).toEqual({ ok: false, reason: "denied" });
  });

  it("position unavailable", async () => {
    const { geo } = fakeGeo((_ok, fail) => fail(err(2)));
    expect(await locateDevice(undefined, geo)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("timeout reported by the browser", async () => {
    const { geo } = fakeGeo((_ok, fail) => fail(err(3)));
    expect(await locateDevice(undefined, geo)).toEqual({ ok: false, reason: "timeout" });
  });

  it("no Geolocation API at all", async () => {
    expect(await locateDevice(undefined, undefined)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("getCurrentPosition throwing synchronously (blocked by policy / insecure context)", async () => {
    const geo = {
      getCurrentPosition: () => {
        throw new Error("Geolocation has been disabled in this document by permissions policy");
      },
    } as unknown as Geolocation;
    await expect(locateDevice(undefined, geo)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("a browser that never calls back still ends in a timeout", async () => {
    vi.useFakeTimers();
    const { geo } = fakeGeo(() => undefined);
    const p = locateDevice(undefined, geo);
    await vi.advanceTimersByTimeAsync(LOCATE_TIMEOUT_MS + 2500);
    await expect(p).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("asks for a coarse fix with an ~8 s timeout", async () => {
    const { geo, getCurrentPosition } = fakeGeo((ok) => ok(position));
    await locateDevice(undefined, geo);
    const opts = getCurrentPosition.mock.calls[0]![2]!;
    expect(opts.enableHighAccuracy).toBe(false);
    expect(opts.timeout).toBe(8000);
    expect(LOCATE_OPTIONS.enableHighAccuracy).toBe(false);
    expect(LOCATE_OPTIONS.timeout).toBe(8000);
  });
});

describe("requestDeviceLocation (legacy rejecting wrapper)", () => {
  it("rejects with a plain Error, never a raw GeolocationPositionError", async () => {
    vi.stubGlobal("navigator", { geolocation: fakeGeo((_ok, fail) => fail(err(1))).geo });
    await expect(requestDeviceLocation()).rejects.toThrow("geolocation denied");
    vi.unstubAllGlobals();
  });
});

describe("failure messages", () => {
  it("exist in en, el and tr", () => {
    for (const locale of LOCALES) {
      const flat = flattenMessages(loadMessages(locale));
      for (const key of Object.values(LOCATION_FAILURE_MESSAGE_KEY)) {
        expect(flat[`common.${key}`], `${locale}:common.${key}`).toBeTruthy();
      }
    }
  });
});

describe("isGeolocationGranted (auto-locate only without a prompt)", () => {
  const perms = (state: string) => ({ query: vi.fn(async () => ({ state }) as PermissionStatus) });

  it("is true only for 'granted'", async () => {
    expect(await isGeolocationGranted(perms("granted"))).toBe(true);
    expect(await isGeolocationGranted(perms("prompt"))).toBe(false);
    expect(await isGeolocationGranted(perms("denied"))).toBe(false);
  });

  it("asks about geolocation", async () => {
    const p = perms("granted");
    await isGeolocationGranted(p);
    expect(p.query).toHaveBeenCalledWith({ name: "geolocation" });
  });

  it("is false when the Permissions API is missing or throws", async () => {
    expect(await isGeolocationGranted(undefined)).toBe(false);
    const throwing = { query: vi.fn(async () => { throw new TypeError("unsupported"); }) };
    expect(await isGeolocationGranted(throwing)).toBe(false);
  });
});
