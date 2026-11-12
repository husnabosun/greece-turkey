import { describe, expect, it } from "vitest";
import { computeQualityScore, proofWeightFromLevel } from "./score-engine";

describe("computeQualityScore", () => {
  it("scores a clean, well-documented field highly", () => {
    const result = computeQualityScore({
      scanHealth: 92,
      healthyTreeShare: 0.95,
      sprayCount12m: 2,
      hasBannedSpray: false,
      daysSinceLastRecord: 5,
      proofWeight: proofWeightFromLevel("evidence_based"),
      peakRiskScore: 20,
      stage: "almost",
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.breakdown.spray).toBeGreaterThanOrEqual(90);
    expect(result.engineVersion).toMatch(/^quality-/);
  });

  it("penalises banned sprays", () => {
    const base = {
      scanHealth: 80,
      healthyTreeShare: 0.9,
      sprayCount12m: 2,
      daysSinceLastRecord: 10,
      proofWeight: 0.7,
      peakRiskScore: 30,
      stage: "growing" as const,
    };
    const clean = computeQualityScore({ ...base, hasBannedSpray: false });
    const banned = computeQualityScore({ ...base, hasBannedSpray: true });
    expect(banned.score).toBeLessThan(clean.score);
    expect(banned.plan.some((p) => /EU-not-approved/i.test(p.text))).toBe(true);
  });
});
