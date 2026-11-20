/** Pure market helpers: prices are rounded to €0.05 and totals to €50. No UI imports. */

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

/** Rounds to the nearest €0.05. Works in cents, so there are no floating point leftovers. */
export const roundPrice = (n: number) => fromCents(Math.round(toCents(n) / 5) * 5);
export const roundTotal = (n: number) => Math.round(n / 50) * 50;

function localeTag(locale?: string) {
  if (!locale) return "el-GR";
  if (locale.startsWith("el")) return "el-GR";
  if (locale.startsWith("tr")) return "tr-TR";
  return "en-GB";
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

export const saleTotal = (tons: number, pricePerKg: number) => roundTotal(tons * 1000 * pricePerKg);
