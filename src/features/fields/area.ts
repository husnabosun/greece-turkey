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

export type AreaUnit = "ha" | "donum" | "stremma";

/** Area unit a locale's farmers think in: EN = hectares, TR = donum, EL = stremma. */
export function areaUnitForLocale(locale: string): AreaUnit {
  if (locale.startsWith("tr")) return "donum";
  if (locale.startsWith("el")) return "stremma";
  return "ha";
}

/**
 * Area (stored in hectares) as a number string in the locale unit. Keeps the stat short enough for a
 * 390px row: one decimal under 100, none from 100 up.
 */
export function formatAreaValue(ha: number, locale: string): { value: string; unit: AreaUnit } {
  const unit = areaUnitForLocale(locale);
  const n = unit === "ha" ? ha : haToStremmata(ha);
  const digits = n >= 100 ? 0 : 1;
  let value: string;
  try {
    value = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(n);
  } catch {
    value = String(Number(n.toFixed(digits)));
  }
  return { value, unit };
}
