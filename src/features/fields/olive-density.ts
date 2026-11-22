import { haToStremmata } from "@/features/fields/area";

/** Realistic GR/TR olive density band (trees per stremma). */
export const TREES_PER_STREMMA_MIN = 15;
export const TREES_PER_STREMMA_MAX = 35;
/** Typical traditional / semi-intensive spacing. */
export const TREES_PER_STREMMA_TYPICAL = 20;

/** Fallback when Vision is unavailable — matches agronomic typical. */
export const TREES_PER_HA_TYPICAL = TREES_PER_STREMMA_TYPICAL * 10; // 200

export type AgronomicGuardrailResult = {
  treeCount: number;
  /** True when Vision was outside the 15–35 / στρέμμα band and we replaced it. */
  adjusted: boolean;
  min: number;
  max: number;
  typical: number;
  stremmata: number;
};

/**
 * If Vision count falls outside [15, 35] trees/στρέμμα, replace with typical 20/στρέμμα.
 * Example: 13.2 στρ → band 198–462, typical 264 (not 105).
 */
export function applyAgronomicGuardrail(treeCount: number, areaHa: number): AgronomicGuardrailResult {
  const stremmata = Math.max(0, haToStremmata(areaHa));
  const min = Math.round(stremmata * TREES_PER_STREMMA_MIN);
  const max = Math.round(stremmata * TREES_PER_STREMMA_MAX);
  const typical = Math.max(1, Math.round(stremmata * TREES_PER_STREMMA_TYPICAL));

  if (stremmata <= 0) {
    return { treeCount: Math.max(0, Math.round(treeCount)), adjusted: false, min, max, typical, stremmata };
  }

  if (treeCount < min || treeCount > max) {
    return { treeCount: typical, adjusted: true, min, max, typical, stremmata };
  }

  return {
    treeCount: Math.max(0, Math.round(treeCount)),
    adjusted: false,
    min,
    max,
    typical,
    stremmata,
  };
}
