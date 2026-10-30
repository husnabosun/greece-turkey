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

/**
 * How the fair price is built. All numbers are starting values, to be checked with real market data.
 * Base: the exchange price. Then small adjustments for quality, banned products and demand.
 */
export const PRICE_RULES = {
  /** The quality score where the adjustment is zero. */
  neutralScore: 70,
  /** €/kg for each score point above or below the neutral score. */
  perScorePoint: 0.005,
  /** €/kg for a field with no banned product in the last 12 months. */
  noBannedBonus: 0.03,
  /** €/kg taken off when a banned product was used in the last 12 months. */
  bannedPenalty: 0.05,
  /** €/kg for each open factory request that fits the field, with a maximum. */
  perRequest: 0.02,
  maxDemand: 0.05,
  /** Suggested range around the fair price, €/kg each way. */
  rangeHalfWidth: 0.05,
  /** "Banned in the last 12 months" window, in days. */
  bannedWindowDays: 365,
} as const;

export interface ExchangePrice {
  /** €/kg */
  pricePerKg: number;
  /** Where the price comes from, e.g. the exchange name. */
  source: string;
  /** Date of the price, as text. */
  date: string;
}

export interface PriceInput {
  score: number;
  /** A banned product was used in the last 12 months. */
  hasBanned: boolean;
  /** Open factory requests that fit this field. */
  fittingRequests: number;
  exchange: ExchangePrice;
}

export interface PriceFactor {
  label: string;
  /** €/kg. The first line is the base, the others are adjustments. */
  amount: number;
  kind: 'base' | 'adjustment';
}

/**
 * The lines of "Why this price?". They always add up to the fair price:
 * base + adjustments + (when needed) a small rounding line to the nearest €0.05.
 */
export function priceFactors(input: PriceInput): PriceFactor[] {
  const r = PRICE_RULES;
  const lines: PriceFactor[] = [
    { label: `Exchange price today · ${input.exchange.source} · ${input.exchange.date}`, amount: fromCents(toCents(input.exchange.pricePerKg)), kind: 'base' },
  ];

  const quality = fromCents(toCents((input.score - r.neutralScore) * r.perScorePoint));
  if (quality !== 0) lines.push({ label: `Quality score is ${input.score}`, amount: quality, kind: 'adjustment' });

  lines.push({
    label: input.hasBanned ? 'Banned product in the last 12 months' : 'No banned products',
    amount: input.hasBanned ? -r.bannedPenalty : r.noBannedBonus,
    kind: 'adjustment',
  });

  const demand = fromCents(Math.min(toCents(r.maxDemand), toCents(input.fittingRequests * r.perRequest)));
  if (demand > 0) {
    lines.push({ label: `${input.fittingRequests} factory request${input.fittingRequests === 1 ? ' fits' : 's fit'} this field`, amount: demand, kind: 'adjustment' });
  }

  const sum = fromCents(lines.reduce((t, l) => t + toCents(l.amount), 0));
  const rounding = fromCents(toCents(roundPrice(sum)) - toCents(sum));
  if (rounding !== 0) lines.push({ label: 'Rounded to €0.05', amount: rounding, kind: 'adjustment' });
  return lines;
}

/** Fair price: the sum of all lines, rounded to €0.05. */
export function fairPrice(input: PriceInput): number {
  return fromCents(priceFactors(input).reduce((t, l) => t + toCents(l.amount), 0));
}

/** Suggested range: fair price ± €0.05. */
export function suggestedRange(fair: number) {
  return { low: roundPrice(fair - PRICE_RULES.rangeHalfWidth), high: roundPrice(fair + PRICE_RULES.rangeHalfWidth) };
}

/** True when a banned spray was applied to the field within the last 12 months. */
export function hasBannedLast12Months(sprays: { fieldId: string; banned: boolean; ts: number }[], fieldId: string, now: number): boolean {
  const from = now - PRICE_RULES.bannedWindowDays * 86_400_000;
  return sprays.some((s) => s.fieldId === fieldId && s.banned && s.ts >= from && s.ts <= now);
}

export interface RequestLike {
  minScore: number;
  noBanned: boolean;
  requests: boolean;
}

/** Number of open factory requests that fit a field (score high enough, and no banned product if the factory asks). */
export function fittingRequests(factories: RequestLike[], score: number, hasBanned: boolean): number {
  return factories.filter((f) => f.requests && score >= f.minScore && !(f.noBanned && hasBanned)).length;
}

export type Verdict = { label: 'Good' | 'Fair' | 'Low'; tone: 'good' | 'warn' | 'risk'; diff: number };

/** How an offer compares with the fair price, in whole 5-cent steps. */
export function offerVerdict(price: number, fair: number): Verdict {
  const diff = roundPrice(price - fair);
  if (diff >= 0.05) return { label: 'Good', tone: 'good', diff };
  if (diff <= -0.05) return { label: 'Low', tone: 'risk', diff };
  return { label: 'Fair', tone: 'warn', diff };
}

export const pctAbove = (price: number, fair: number) => Math.round(((price - fair) / fair) * 100);

export const saleTotal = (tons: number, pricePerKg: number) => roundTotal(tons * 1000 * pricePerKg);
