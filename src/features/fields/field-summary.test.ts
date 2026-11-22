import { describe, expect, it } from "vitest";
import { formatRelativeAge, pickAttentionTreeId, relativeAge } from "@/features/fields/field-summary";

const NOW = new Date("2026-11-23T12:00:00Z");

describe("relativeAge", () => {
  it("handles missing / invalid input", () => {
    expect(relativeAge(null, NOW)).toBeNull();
    expect(relativeAge("nope", NOW)).toBeNull();
  });

  it("returns days, then months", () => {
    expect(relativeAge("2026-11-23T08:00:00Z", NOW)).toEqual({ value: 0, unit: "day" });
    expect(relativeAge("2026-11-20T12:00:00Z", NOW)).toEqual({ value: 3, unit: "day" });
    expect(relativeAge("2026-08-23T12:00:00Z", NOW)).toEqual({ value: 3, unit: "month" });
  });

  it("treats a future timestamp as today", () => {
    expect(relativeAge("2026-12-30T00:00:00Z", NOW)).toEqual({ value: 0, unit: "day" });
  });

  it("formats in the locale", () => {
    expect(formatRelativeAge({ value: 3, unit: "day" }, "en")).toBe("3 days ago");
  });
});

describe("pickAttentionTreeId", () => {
  it("prefers diseased, then suspicious, else null", () => {
    expect(
      pickAttentionTreeId([
        { id: 1, status: "healthy" },
        { id: 2, status: "suspicious" },
        { id: 3, status: "diseased" },
      ]),
    ).toBe(3);
    expect(
      pickAttentionTreeId([
        { id: 1, status: "healthy" },
        { id: 2, status: "suspicious" },
      ]),
    ).toBe(2);
    expect(pickAttentionTreeId([{ id: 1, status: "healthy" }])).toBeNull();
    expect(pickAttentionTreeId([])).toBeNull();
  });
});
