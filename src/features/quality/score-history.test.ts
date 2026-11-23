import { describe, expect, it } from "vitest";
import { buildScoreHistory, historyWindowStart, monthSinceLabel, scoreAxis } from "@/features/quality/score-history";

const NOW = new Date(2026, 10, 22, 12); // 22 Nov 2026 (local); window = Jun..Nov
const at = (y: number, m: number, d = 15) => new Date(y, m, d, 10).toISOString();

describe("buildScoreHistory", () => {
  it("returns no history for no rows", () => {
    const h = buildScoreHistory([], NOW);
    expect(h.points).toEqual([]);
    expect(h.hasHistory).toBe(false);
    expect(h.change).toBe(0);
    expect(h.since).toBeNull();
  });

  it("a single point is not a history", () => {
    const h = buildScoreHistory([{ score: 80, computedAt: at(2026, 10) }], NOW);
    expect(h.points).toHaveLength(1);
    expect(h.points[0]!.current).toBe(true);
    expect(h.hasHistory).toBe(false);
    expect(h.since).toBeNull();
  });

  it("keeps the latest score per month and orders oldest first", () => {
    const h = buildScoreHistory(
      [
        { score: 90, computedAt: at(2026, 10, 20) },
        { score: 60, computedAt: at(2026, 10, 2) },
        { score: 70, computedAt: at(2026, 7, 5) },
        { score: 74, computedAt: at(2026, 7, 25) },
      ],
      NOW,
    );
    expect(h.points.map((p) => p.score)).toEqual([74, 90]);
    expect(h.points.map((p) => p.slot)).toEqual([2, 5]);
    expect(h.points[1]!.current).toBe(true);
    expect(h.points[0]!.current).toBe(false);
  });

  it("computes the change and since-month from first to last point", () => {
    const h = buildScoreHistory(
      [
        { score: 72, computedAt: at(2026, 5) },
        { score: 65, computedAt: at(2026, 8) },
        { score: 78, computedAt: at(2026, 10) },
      ],
      NOW,
    );
    expect(h.hasHistory).toBe(true);
    expect(h.change).toBe(6);
    expect(h.since).toEqual(new Date(2026, 5, 1));
  });

  it("reports a decrease as negative", () => {
    const h = buildScoreHistory(
      [
        { score: 88, computedAt: at(2026, 6) },
        { score: 80, computedAt: at(2026, 10) },
      ],
      NOW,
    );
    expect(h.change).toBe(-8);
  });

  it("ignores rows outside the 6-month window and future rows", () => {
    const h = buildScoreHistory(
      [
        { score: 50, computedAt: at(2026, 4) }, // May: too old
        { score: 60, computedAt: at(2026, 5) }, // Jun: oldest in window
        { score: 99, computedAt: at(2026, 11) }, // Dec: future
      ],
      NOW,
    );
    expect(h.points.map((p) => p.score)).toEqual([60]);
  });

  it("works across a year boundary", () => {
    const now = new Date(2027, 1, 10); // Feb 2027, window Sep 2026..Feb 2027
    const h = buildScoreHistory(
      [
        { score: 55, computedAt: at(2026, 8) },
        { score: 65, computedAt: at(2027, 1) },
      ],
      now,
    );
    expect(h.points.map((p) => p.slot)).toEqual([0, 5]);
    expect(h.change).toBe(10);
    expect(historyWindowStart(now)).toEqual(new Date(2026, 8, 1));
  });

  it("drops malformed rows and clamps scores to 0-100", () => {
    const h = buildScoreHistory(
      [
        { score: Number.NaN, computedAt: at(2026, 9) },
        { score: 80, computedAt: "not a date" },
        { score: 140, computedAt: at(2026, 8) },
        { score: 71.6, computedAt: at(2026, 10) },
      ],
      NOW,
    );
    expect(h.points.map((p) => p.score)).toEqual([100, 72]);
  });
});

describe("scoreAxis", () => {
  it("zooms to the data in steps of 10", () => {
    expect(scoreAxis([72, 78])).toEqual({ lo: 60, hi: 90, ticks: [60, 70, 80, 90] });
  });

  it("keeps at least a 20 point span and stays within 0-100", () => {
    const a = scoreAxis([100, 100]);
    expect(a.hi).toBe(100);
    expect(a.hi - a.lo).toBeGreaterThanOrEqual(20);
    const b = scoreAxis([2, 3]);
    expect(b.lo).toBe(0);
    expect(b.hi - b.lo).toBeGreaterThanOrEqual(20);
  });

  it("falls back to 0-100 without data", () => {
    expect(scoreAxis([])).toEqual({ lo: 0, hi: 100, ticks: [0, 50, 100] });
  });
});

describe("monthSinceLabel", () => {
  it("uses the full Turkish month name with the right ablative suffix", () => {
    const expected = [
      "Ocak'tan", "Şubat'tan", "Mart'tan", "Nisan'dan", "Mayıs'tan", "Haziran'dan",
      "Temmuz'dan", "Ağustos'tan", "Eylül'den", "Ekim'den", "Kasım'dan", "Aralık'tan",
    ];
    expected.forEach((label, i) => expect(monthSinceLabel(new Date(2026, i, 1), "tr")).toBe(label));
  });

  it("keeps a short month name for other languages", () => {
    expect(monthSinceLabel(new Date(2026, 5, 1), "en")).toBe("Jun");
  });
});
