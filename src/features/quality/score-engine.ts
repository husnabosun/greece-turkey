/**
 * Dynamic Quality Score engine (0–100).
 * Pure TypeScript — no UI / DB imports. Inputs are already-normalised domain facts.
 */

export const QUALITY_ENGINE_VERSION = "quality-0.1";

export type QualityBreakdown = {
  /** Tree / grove health from scans & tree status. */
  tree: number;
  /** Spray discipline + EU compliance. */
  spray: number;
  /** Harvest readiness / timing signals. */
  harvest: number;
  /** Completeness of digital records (logbook, proofs). */
  records: number;
};

export type QualityPlanItem = {
  text: string;
  /** Expected score points if the farmer completes this. */
  points: number;
};

export type QualityInput = {
  /** 0–100 from recent leaf/fruit scan health (100 = clean). */
  scanHealth: number;
  /** Share of trees marked healthy (0–1). */
  healthyTreeShare: number;
  /** Sprays in the last 12 months. */
  sprayCount12m: number;
  /** True when any banned substance was used in the last 12 months. */
  hasBannedSpray: number | boolean;
  /** Days since last logbook entry; null = never. */
  daysSinceLastRecord: number | null;
  /** Proof / evidence level weight 0–1 (self=0.3, evidence=0.7, lab=1). */
  proofWeight: number;
  /** Current agronomic risk 0–100 (higher = worse). */
  peakRiskScore: number;
  /** Crop stage heuristic: growing | almost | harvested. */
  stage: "growing" | "almost" | "harvested";
};

export type QualityResult = {
  score: number;
  breakdown: QualityBreakdown;
  plan: QualityPlanItem[];
  engineVersion: string;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Math.round(n)));

function sprayScore(count: number, banned: boolean): number {
  if (banned) return 35;
  if (count === 0) return 88;
  if (count <= 2) return 92;
  if (count <= 4) return 78;
  return 62;
}

function recordsScore(daysSince: number | null, proofWeight: number): number {
  const freshness =
    daysSince === null ? 40 : daysSince <= 14 ? 95 : daysSince <= 45 ? 80 : daysSince <= 90 ? 60 : 40;
  return clamp(freshness * 0.7 + proofWeight * 100 * 0.3);
}

function harvestScore(stage: QualityInput["stage"], peakRisk: number): number {
  const base = stage === "harvested" ? 90 : stage === "almost" ? 82 : 74;
  return clamp(base - peakRisk * 0.15);
}

function treeScore(scanHealth: number, healthyShare: number, peakRisk: number): number {
  return clamp(scanHealth * 0.55 + healthyShare * 100 * 0.35 + (100 - peakRisk) * 0.1);
}

export function computeQualityScore(input: QualityInput): QualityResult {
  const banned = Boolean(input.hasBannedSpray);
  const breakdown: QualityBreakdown = {
    tree: treeScore(input.scanHealth, input.healthyTreeShare, input.peakRiskScore),
    spray: sprayScore(input.sprayCount12m, banned),
    harvest: harvestScore(input.stage, input.peakRiskScore),
    records: recordsScore(input.daysSinceLastRecord, input.proofWeight),
  };

  // Weighted overall — mirrors the legacy mock breakdown intent.
  const score = clamp(
    breakdown.tree * 0.3 + breakdown.spray * 0.3 + breakdown.harvest * 0.2 + breakdown.records * 0.2,
  );

  const plan: QualityPlanItem[] = [];
  if (banned) plan.push({ text: "Stop using EU-not-approved products and record an approved alternative with an agronomist.", points: 12 });
  if (breakdown.records < 80) plan.push({ text: "Add missing spray records and keep the logbook up to date.", points: 8 });
  if (input.peakRiskScore >= 65) plan.push({ text: "Check traps and leaves this week — risk is high on this field.", points: 6 });
  if (input.healthyTreeShare < 0.85) plan.push({ text: "Re-check suspicious trees and save a new scan photo.", points: 5 });
  if (plan.length === 0) plan.push({ text: "Keep weekly checks and record every spray after you apply it.", points: 2 });

  return { score, breakdown, plan: plan.slice(0, 4), engineVersion: QUALITY_ENGINE_VERSION };
}

export function proofWeightFromLevel(level: "self_reported" | "evidence_based" | "lab_verified"): number {
  if (level === "lab_verified") return 1;
  if (level === "evidence_based") return 0.7;
  return 0.35;
}
