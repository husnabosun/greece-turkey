/** Pure market helpers. Prices round to €0.05 in pickers; money totals are exact to the cent. No UI imports. */

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

/** Rounds to the nearest €0.05. Works in cents, so there are no floating point leftovers. */
export const roundPrice = (n: number) => fromCents(Math.round(toCents(n) / 5) * 5);
export const roundTotal = (n: number) => Math.round(n / 50) * 50;

/** BCP-47 tag used for Intl formatting. English (and any unknown locale) uses en-GB: day-first, € after a thin sign. */
export function intlTag(locale?: string) {
  if (locale?.startsWith("el")) return "el-GR";
  if (locale?.startsWith("tr")) return "tr-TR";
  return "en-GB";
}

const localeTag = intlTag;

/** A number for a text input in the user's decimal style ("1,55" in el/tr, "1.55" in en), never grouped. */
export function formatDecimalInput(n: number, locale: string, digits = 2) {
  return new Intl.NumberFormat(intlTag(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(n);
}

function asDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(0, 10)}T12:00:00` : d;
  return new Date(iso);
}

/** "1,55 €" / "30.000 €" — 2 fraction digits under €10, none at/above. */
export function formatEuro(n: number, locale: string) {
  const digits = n < 10 ? 2 : 0;
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** "1,55 €/kg" */
export function formatEuroPerKg(n: number, locale: string) {
  return `${formatEuro(n, locale)}/kg`;
}

/** "1,55 €" / "€1.55" depending on locale. */
export function euroPrice(n: number, locale?: string) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** "30.000 €" / "€30,000" depending on locale. */
export function euroTotal(n: number, locale?: string) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** "2,5 t" / "33 t" — always a space before the unit. */
export function formatTons(n: number, locale?: string) {
  const body = new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: n % 1 ? 1 : 0,
  }).format(n);
  return `${body} t`;
}

/** "27 Νοε" */
export function formatDateShort(d: string | Date, locale: string) {
  const dt = asDate(d);
  if (Number.isNaN(dt.getTime())) return typeof d === "string" ? d : "—";
  return dt.toLocaleDateString(localeTag(locale), { day: "numeric", month: "short" });
}

/**
 * "27 Νοε–4 Δεκ", or "3–10 Νοε" when both dates share the same month/year.
 */
export function formatDateRange(a: string | Date, b: string | Date, locale: string) {
  const start = asDate(a);
  const end = asDate(b);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${formatDateShort(a, locale)}–${formatDateShort(b, locale)}`;
  }
  const tag = localeTag(locale);
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const month = end.toLocaleDateString(tag, { month: "short" });
    return `${start.getDate()}–${end.getDate()} ${month}`;
  }
  return `${formatDateShort(start, locale)}–${formatDateShort(end, locale)}`;
}

/** "Banned in the last 12 months" window, in days. */
export const BANNED_WINDOW_DAYS = 365;

/** Lowest, highest and average price of the local commodity exchange today, €/kg. */
export interface ExchangeRange {
  min: number;
  max: number;
  avg: number;
}

/** "€0.75 – €0.90" */
export const exchangeSpan = (r: ExchangeRange) => `${euroPrice(r.min)} – ${euroPrice(r.max)}`;

export type RangeVerdict = { id: 'above' | 'within' | 'below'; label: 'Above range' | 'Within range' | 'Below range'; tone: 'good' | 'warn' | 'risk' };

/**
 * Where an offer or a price sits against today's exchange range. This is the only comparison the farmer app makes:
 * it never says what a price should be. Null when there is no exchange data for the area.
 */
export function compareToRange(price: number, range: ExchangeRange | null | undefined): RangeVerdict | null {
  if (!range) return null;
  if (price > range.max) return { id: 'above', label: 'Above range', tone: 'good' };
  if (price < range.min) return { id: 'below', label: 'Below range', tone: 'risk' };
  return { id: 'within', label: 'Within range', tone: 'warn' };
}

/** True when a banned spray was applied to the field within the last 12 months. */
export function hasBannedLast12Months(sprays: { fieldId: string; banned: boolean; ts: number }[], fieldId: string, now: number): boolean {
  const from = now - BANNED_WINDOW_DAYS * 86_400_000;
  return sprays.some((s) => s.fieldId === fieldId && s.banned && s.ts >= from && s.ts <= now);
}

/** Exact sale amount in euros (to the cent). Both sides must show the same number, so never round to €50. */
export const saleTotal = (tons: number, pricePerKg: number) => Math.round(tons * 1000 * pricePerKg * 100) / 100;

/**
 * Locale-aware number parser for user input ("12.300" Greek thousands, "12,5" decimal comma, "12 300").
 * Returns null for anything that is not a plain positive decimal (no "1e6", "0x10", "-5").
 */
export function parseLocaleNumber(raw: string): number | null {
  let s = String(raw ?? "").trim().replace(/[\s\u00a0\u202f']/g, "");
  if (!s) return null;
  if (!/^[0-9.,]+$/.test(s)) return null;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thou = dec === "." ? "," : ".";
    s = s.split(thou).join("");
    if (dec === ",") s = s.replace(",", ".");
  } else if (hasComma) {
    if (/^\d{1,3}(,\d{3})+$/.test(s) && s.split(",").length > 2) s = s.split(",").join("");
    else s = s.replace(",", ".");
  } else if (hasDot) {
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Same bounds the database CHECK constraints enforce (see migration 20261121020000). */
export const MARKET_LIMITS = {
  lotTons: { min: 0.1, max: 500 },
  pricePerKg: { min: 0.05, max: 20 },
  requestTons: { min: 0.1, max: 2000 },
} as const;

export type BoundedResult =
  | { ok: true; value: number }
  | { ok: false; reason: "invalid" | "tooLow" | "tooHigh"; min: number; max: number };

export function parseBounded(raw: string, bounds: { min: number; max: number }): BoundedResult {
  const n = parseLocaleNumber(raw);
  if (n == null || n <= 0) return { ok: false, reason: "invalid", ...bounds };
  if (n < bounds.min) return { ok: false, reason: "tooLow", ...bounds };
  if (n > bounds.max) return { ok: false, reason: "tooHigh", ...bounds };
  return { ok: true, value: n };
}
