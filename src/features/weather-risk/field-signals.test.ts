import { describe, expect, it } from "vitest";
import { buildFieldSignals, type ScanInput, type SprayInput } from "./field-signals";
import { around, inputFor } from "./risk/testUtils";
import { oliveFly } from "./risk/threats/oliveFly";
import { peacockSpot } from "./risk/threats/peacockSpot";

const field = { id: "f1", varietySlug: "koroneiki" };

/** Perfect olive fly weather at ripening, today is 5 Oct 2026 (as in risk.test.ts). */
const flyWeather = () => around("2026-10-05", { tMean: 23, tMin: 18, tMax: 28, rhMean: 80 });
const trap = (flies: number, extra: Partial<ScanInput> = {}): ScanInput => ({
  fieldId: "f1",
  at: "2026-10-04T12:00:00Z",
  mode: "trap",
  titleKey: "trapTitle",
  title: "Παγίδα: 20 μύγες",
  tone: "warn",
  flyCount: flies,
  ...extra,
});

const kaolin = (extra: Partial<SprayInput> = {}): SprayInput => ({
  fieldId: "f1",
  at: "2026-10-02T12:00:00Z",
  product: "Kaolin clay",
  substances: ["kaolin"],
  banned: false,
  targets: [],
  protectionDays: null,
  ...extra,
});

describe("buildFieldSignals: scans", () => {
  it("a trap with many flies makes olive fly High, while weather alone stays Medium", () => {
    const w = flyWeather();
    expect(oliveFly.assess(inputFor(w, 14, buildFieldSignals(field, [], []))).level).toBe("Medium");
    const a = oliveFly.assess(inputFor(w, 14, buildFieldSignals(field, [trap(20)], [])));
    expect(a.level).toBe("High");
    expect(a.drivers.join(" ")).toMatch(/Trap count: 20 flies/);
  });

  it("a trap with few flies does not make it High", () => {
    const a = oliveFly.assess(inputFor(flyWeather(), 14, buildFieldSignals(field, [trap(1)], [])));
    expect(a.level).not.toBe("High");
  });

  it("reads the fly count from the diagnosis JSON when the column is empty", () => {
    const s = trap(0, { flyCount: null, diagnosis: { mode: "trap", result: { flyCount: 20 } } });
    expect(buildFieldSignals(field, [s], []).scans[0].flies).toBe(20);
  });

  it("finds an olive fly sting in any language through the stable title key", () => {
    const sting: ScanInput = { fieldId: "f1", at: "2026-10-04T12:00:00Z", mode: "fruit", titleKey: "oliveFly", title: "Τσίμπημα μύγας", tone: "risk" };
    const a = oliveFly.assess(inputFor(flyWeather(), 14, buildFieldSignals(field, [sting], [])));
    expect(a.level).toBe("High");
    expect(a.drivers.join(" ")).toMatch(/Olive fly sting found/);
  });

  it("falls back to the AI label of old rows without a title key", () => {
    const old: ScanInput = { fieldId: "f1", at: "2026-11-09T12:00:00Z", mode: "leaf", title: "", tone: "risk", diagnosis: { result: { label: "Olive Peacock Spot" } } };
    const w = around("2026-11-10", { tMean: 15, tMin: 12, tMax: 18, wetHours: 5 }, { 0: { rain: 3, rainyHours: 3, wetHours: 8 } });
    const withScan = peacockSpot.assess(inputFor(w, 14, buildFieldSignals(field, [old], [])));
    const without = peacockSpot.assess(inputFor(w, 14, buildFieldSignals(field, [], [])));
    expect(withScan.score).toBeGreaterThan(without.score);
  });

  it("ignores scans of other fields, trap counts on other modes and broken dates", () => {
    const s = buildFieldSignals(field, [trap(20, { fieldId: "other" }), trap(20, { at: "not a date" }), { ...trap(20), mode: "leaf" }], []);
    expect(s.scans).toHaveLength(1);
    expect(s.scans[0].flies).toBeUndefined();
  });
});

describe("buildFieldSignals: sprays", () => {
  it("an approved spray lowers the risk it targets", () => {
    const w = flyWeather();
    const before = oliveFly.assess(inputFor(w, 14, buildFieldSignals(field, [], []))).score;
    const a = oliveFly.assess(inputFor(w, 14, buildFieldSignals(field, [], [kaolin()])));
    expect(a.score).toBeLessThan(before);
    expect(a.drivers.join(" ")).toMatch(/Protected by kaolin clay/);
  });

  it("uses the targets and days stored in the logbook when there are some", () => {
    const s = buildFieldSignals(field, [], [kaolin({ product: "My product", substances: [], targets: ["peacock-spot", "nonsense"], protectionDays: 7 })]);
    expect(s.sprays[0]).toMatchObject({ targets: ["peacock-spot"], protectionDays: 7, banned: false });
  });

  it("copper protects the leaf diseases, not the fly", () => {
    const copper = kaolin({ product: "Copper oxychloride 50 WP", substances: ["copper oxychloride"] });
    expect(buildFieldSignals(field, [], [copper]).sprays[0].targets).toEqual(["peacock-spot", "anthracnose", "olive-knot"]);
    const w = flyWeather();
    expect(oliveFly.assess(inputFor(w, 14, buildFieldSignals(field, [], [copper]))).score).toBe(oliveFly.assess(inputFor(w)).score);
  });

  it("a banned spray never protects", () => {
    const w = flyWeather();
    const bad = kaolin({ banned: true });
    const s = buildFieldSignals(field, [], [bad]);
    expect(s.sprays[0]).toMatchObject({ banned: true, targets: [], protectionDays: 0 });
    expect(oliveFly.assess(inputFor(w, 14, s)).score).toBe(oliveFly.assess(inputFor(w)).score);
  });

  it("an unknown product without targets protects nothing and gives a finite score", () => {
    const w = flyWeather();
    const s = buildFieldSignals(field, [], [kaolin({ product: "Mystery", substances: ["xyz"] })]);
    expect(s.sprays[0]).toMatchObject({ targets: [], protectionDays: 0 });
    expect(Number.isFinite(oliveFly.assess(inputFor(w, 14, s)).score)).toBe(true);
  });

  it("protection ends after its days", () => {
    const w = flyWeather();
    const old = kaolin({ at: "2026-09-10T12:00:00Z" });
    expect(oliveFly.assess(inputFor(w, 14, buildFieldSignals(field, [], [old]))).score).toBe(oliveFly.assess(inputFor(w)).score);
  });

  it("keeps only the sprays of this field", () => {
    expect(buildFieldSignals(field, [], [kaolin({ fieldId: "other" })]).sprays).toHaveLength(0);
  });
});

describe("buildFieldSignals: field", () => {
  it("carries the variety slug", () => {
    expect(buildFieldSignals(field, [], []).varietySlug).toBe("koroneiki");
    expect(buildFieldSignals({ id: "f2" }, [], []).varietySlug).toBeNull();
  });
});
