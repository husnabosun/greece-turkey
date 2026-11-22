import { describe, expect, it } from "vitest";
import {
  canOverwriteTreeCount,
  parseTreeCountSource,
  sourceAfterEdit,
  sourceForNewField,
  withTreeCountSource,
} from "@/features/fields/tree-count-source";

describe("tree count source in notes", () => {
  it("reads the source, or null for legacy / missing / junk notes", () => {
    expect(parseTreeCountSource(JSON.stringify({ tree_count_source: "satellite" }))).toBe("satellite");
    expect(parseTreeCountSource(JSON.stringify({ tree_count_source: "farmer" }))).toBe("farmer");
    expect(parseTreeCountSource(JSON.stringify({ tree_age_years: 35 }))).toBeNull();
    expect(parseTreeCountSource(JSON.stringify({ tree_count_source: "guess" }))).toBeNull();
    expect(parseTreeCountSource("just a text note")).toBeNull();
    expect(parseTreeCountSource(null)).toBeNull();
    expect(parseTreeCountSource("")).toBeNull();
  });

  it("sets the source and keeps every other key", () => {
    const before = JSON.stringify({ tree_age_years: 35, crop_stage: "growing" });
    const after = JSON.parse(withTreeCountSource(before, "density"));
    expect(after).toEqual({ tree_age_years: 35, crop_stage: "growing", tree_count_source: "density" });
  });

  it("replaces an earlier source", () => {
    const n = withTreeCountSource(withTreeCountSource(null, "satellite"), "farmer");
    expect(parseTreeCountSource(n)).toBe("farmer");
  });

  it("keeps plain-text legacy notes instead of dropping them", () => {
    const after = JSON.parse(withTreeCountSource("old note", "farmer"));
    expect(after).toEqual({ legacy_note: "old note", tree_count_source: "farmer" });
  });
});

describe("choosing the source", () => {
  it("new field: farmer > satellite > density", () => {
    expect(sourceForNewField({ farmerEdited: true, hasSatelliteCount: true, hasDensityEstimate: true })).toBe("farmer");
    expect(sourceForNewField({ farmerEdited: false, hasSatelliteCount: true, hasDensityEstimate: true })).toBe("satellite");
    expect(sourceForNewField({ farmerEdited: false, hasSatelliteCount: false, hasDensityEstimate: true })).toBe("density");
    expect(sourceForNewField({ farmerEdited: false, hasSatelliteCount: false, hasDensityEstimate: false })).toBeNull();
  });

  it("a farmer-confirmed count is never overwritten by an estimate", () => {
    expect(canOverwriteTreeCount("farmer")).toBe(false);
    expect(canOverwriteTreeCount("satellite")).toBe(true);
    expect(canOverwriteTreeCount("density")).toBe(true);
    expect(canOverwriteTreeCount(null)).toBe(true);
  });

  it("editing: a changed number becomes farmer-confirmed, an unchanged one keeps its source", () => {
    expect(sourceAfterEdit(247, 300, "satellite")).toBe("farmer");
    expect(sourceAfterEdit(247, 247, "satellite")).toBe("satellite");
    expect(sourceAfterEdit(247, 247, "farmer")).toBe("farmer");
    expect(sourceAfterEdit(null, 120, null)).toBe("farmer");
    expect(sourceAfterEdit(247, null, "density")).toBe("density");
  });
});
