/** Pure market helpers: prices are rounded to €0.05 and totals to €50. No UI imports. */

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

/** Rounds to the nearest €0.05. Works in cents, so there are no floating point leftovers. */
export const roundPrice = (n: number) => fromCents(Math.round(toCents(n) / 5) * 5);
export const roundTotal = (n: number) => Math.round(n / 50) * 50;

/** "€0.90" */
export const euroPrice = (n: number) => `€${n.toFixed(2)}`;
/** "€2,450" */
export const euroTotal = (n: number) => `€${n.toLocaleString('en-US')}`;

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
