import { describe, expect, it } from "vitest";
import {
  LOCALE_START_VIEW,
  REGIONS_GR,
  REGIONS_TR,
  resolveStartView,
  viewForLocale,
  viewForProfilePlace,
} from "@/features/fields/start-view";

const NONE = { fieldBounds: null, saved: null, profilePlace: null } as const;

describe("viewForLocale", () => {
  it("tr -> Ayvalik / Edremit, el -> Lesvos, en -> the strait between", () => {
    expect(viewForLocale("tr").center).toEqual(LOCALE_START_VIEW.tr.center);
    expect(viewForLocale("el").center).toEqual(LOCALE_START_VIEW.el.center);
    const [enLon] = viewForLocale("en").center;
    expect(enLon).toBeGreaterThan(LOCALE_START_VIEW.el.center[0] - 0.01);
    expect(enLon).toBeLessThan(LOCALE_START_VIEW.tr.center[0] + 0.01);
  });

  it("the English view is wider so both areas fit", () => {
    expect(viewForLocale("en").zoom).toBeLessThan(viewForLocale("tr").zoom);
  });

  it("unknown locale behaves like English", () => {
    expect(viewForLocale("de")).toEqual(viewForLocale("en"));
  });

  it("stays in the olive Aegean (never the old Athens default)", () => {
    for (const l of ["tr", "el", "en"] as const) {
      const [lon, lat] = LOCALE_START_VIEW[l].center;
      expect(lon).toBeGreaterThan(25.5);
      expect(lon).toBeLessThan(27.5);
      expect(lat).toBeGreaterThan(38.5);
      expect(lat).toBeLessThan(40);
    }
  });
});

describe("viewForProfilePlace", () => {
  it("matches the region in any language, ignoring case and accents", () => {
    const lesvos = REGIONS_GR[0]!.center;
    expect(viewForProfilePlace("North Aegean")?.center).toEqual(lesvos);
    expect(viewForProfilePlace("Βόρειο Αιγαίο")?.center).toEqual(lesvos);
    expect(viewForProfilePlace("βορειο αιγαιο")?.center).toEqual(lesvos);
    expect(viewForProfilePlace("Kuzey Ege")?.center).toEqual(lesvos);
    expect(viewForProfilePlace("İzmir")?.center).toEqual(REGIONS_TR[0]!.center);
    expect(viewForProfilePlace("izmir")?.center).toEqual(REGIONS_TR[0]!.center);
    expect(viewForProfilePlace("Σμύρνη")?.center).toEqual(REGIONS_TR[0]!.center);
  });

  it("is null for empty or unknown places", () => {
    expect(viewForProfilePlace(null)).toBeNull();
    expect(viewForProfilePlace("  ")).toBeNull();
    expect(viewForProfilePlace("Atlantis")).toBeNull();
  });
});

describe("resolveStartView order", () => {
  const bounds: [[number, number], [number, number]] = [[26, 39], [26.02, 39.02]];
  const saved = { center: [23.7, 37.9] as [number, number], zoom: 12.5 };

  it("1. the user's fields win", () => {
    const v = resolveStartView({ fieldBounds: bounds, saved, profilePlace: "Crete", locale: "tr" });
    expect(v.source).toBe("fields");
    expect(v.bounds).toEqual(bounds);
    expect(v.center[0]).toBeCloseTo(26.01, 5);
    expect(v.center[1]).toBeCloseTo(39.01, 5);
  });

  it("then the position the user last picked on a map", () => {
    const v = resolveStartView({ fieldBounds: null, saved, profilePlace: "Crete", locale: "tr" });
    expect(v.source).toBe("saved");
    expect(v.center).toEqual(saved.center);
  });

  it("2. the profile region when there are no fields", () => {
    const v = resolveStartView({ ...NONE, profilePlace: "Crete", locale: "tr" });
    expect(v.source).toBe("profile");
    expect(v.center).toEqual(REGIONS_GR[1]!.center);
  });

  it("3. the locale when there is nothing else", () => {
    expect(resolveStartView({ ...NONE, locale: "tr" })).toMatchObject({ source: "locale", center: LOCALE_START_VIEW.tr.center });
    expect(resolveStartView({ ...NONE, locale: "el" })).toMatchObject({ source: "locale", center: LOCALE_START_VIEW.el.center });
    expect(resolveStartView({ ...NONE, locale: "en" })).toMatchObject({ source: "locale", center: LOCALE_START_VIEW.en.center });
  });

  it("an unknown profile place falls through to the locale", () => {
    expect(resolveStartView({ ...NONE, profilePlace: "Atlantis", locale: "el" }).source).toBe("locale");
  });
});
