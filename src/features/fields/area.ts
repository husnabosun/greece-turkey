/** 1 hectare = 10 stremmata (στρέμματα) ≈ 10 Turkish dönüm. */
export const STREMMATA_PER_HA = 10;

export function haToStremmata(ha: number): number {
  return ha * STREMMATA_PER_HA;
}

/** Format hectares as stremmata for UI (1 decimal by default). */
export function formatStremmata(ha: number, digits = 1): string {
  return haToStremmata(ha).toFixed(digits);
}
