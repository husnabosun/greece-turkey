import { describe, expect, it } from "vitest";
import { fitBoundsFor, treeFrameBounds } from "@/features/fields/map-fit";
import { areaUnitForLocale, formatAreaValue } from "@/features/fields/area";

const poly = (x: number, y: number, s = 0.01) => ({
  type: "Polygon",
  coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});

describe("fitBoundsFor", () => {
  it("frames the selected field polygon", () => {
    expect(fitBoundsFor({ geom: poly(26, 39) })).toEqual([[26, 39], [26.01, 39.01]]);
  });

  it("frames the union of all outlines", () => {
    const b = fitBoundsFor({ outlines: [{ geom: poly(26, 39) }, { geom: poly(24, 38) }] });
    expect(b).toEqual([[24, 38], [26.01, 39.01]]);
  });

  it("falls back to pins when fields have no polygon", () => {
    const b = fitBoundsFor({
      outlines: [{ geom: null }],
      points: [{ lat: 39, lon: 26 }, { lat: 38, lon: 24 }],
    });
    expect(b).toEqual([[24, 38], [26, 39]]);
  });

  it("falls back to the selected field pin", () => {
    expect(fitBoundsFor({ geom: null, lat: 39, lon: 26 })).toEqual([[26, 39], [26, 39]]);
  });

  it("returns null when nothing is locatable and ignores junk coordinates", () => {
    expect(fitBoundsFor({})).toBeNull();
    expect(fitBoundsFor({ lat: Number.NaN, lon: 26 })).toBeNull();
    expect(fitBoundsFor({ lat: 91, lon: 26 })).toBeNull();
  });
});

describe("treeFrameBounds", () => {
  it("uses the polygon when present", () => {
    expect(treeFrameBounds({ geom: poly(26, 39) })).toEqual([[26, 39], [26.01, 39.01]]);
  });

  it("builds a frame around a pin so tree dots still show", () => {
    const b = treeFrameBounds({ geom: null, lat: 39, lon: 26, areaHa: 1 })!;
    expect(b[0][0]).toBeLessThan(26);
    expect(b[1][0]).toBeGreaterThan(26);
    expect(b[0][1]).toBeLessThan(39);
    expect(b[1][1]).toBeGreaterThan(39);
    expect((b[1][1] - b[0][1]) * 111_320).toBeCloseTo(100, 0); // 1 ha -> 100 m side
  });

  it("returns null with neither polygon nor pin", () => {
    expect(treeFrameBounds({})).toBeNull();
  });
});

describe("area units", () => {
  it("picks the unit by locale", () => {
    expect(areaUnitForLocale("en")).toBe("ha");
    expect(areaUnitForLocale("tr")).toBe("donum");
    expect(areaUnitForLocale("el")).toBe("stremma");
  });

  it("converts hectares and keeps numbers short", () => {
    expect(formatAreaValue(24.7, "en")).toEqual({ value: "24.7", unit: "ha" });
    expect(formatAreaValue(24.7, "tr")).toEqual({ value: "247", unit: "donum" });
    expect(formatAreaValue(24.7, "el")).toEqual({ value: "247", unit: "stremma" });
    expect(formatAreaValue(1.25, "el")).toEqual({ value: "12,5", unit: "stremma" });
  });
});
