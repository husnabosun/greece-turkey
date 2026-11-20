/** 1 hectare = 10 stremmata (στρέμματα) ≈ 10 Turkish dönüm. */
export const STREMMATA_PER_HA = 10;

export function haToStremmata(ha: number): number {
  return ha * STREMMATA_PER_HA;
}

/** Format hectares as stremmata for UI (1 decimal by default, locale-aware comma). */
export function formatStremmata(ha: number, digits = 1, locale = "el"): string {
  const n = haToStremmata(ha);
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return n.toFixed(digits);
  }
}
