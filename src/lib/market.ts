/** Pure market helpers: prices are rounded to €0.05 and totals to €50. No UI imports. */

export const roundPrice = (n: number) => Math.round(n / 0.05) * 0.05;
export const roundTotal = (n: number) => Math.round(n / 50) * 50;

/** "€0.90" */
export const euroPrice = (n: number) => `€${n.toFixed(2)}`;
/** "€2,450" */
export const euroTotal = (n: number) => `€${n.toLocaleString('en-US')}`;

export interface PriceFactor {
  label: string;
  amount: number;
}

const BASE_PRICE = 0.55;

/** Why a field gets its price: base plus bonuses. Placeholder rules until the real engine lands in score.ts. */
export function priceFactors(score: number, hasBanned: boolean, highDemand = true): PriceFactor[] {
  const quality = score >= 85 ? 0.15 : score >= 75 ? 0.1 : score >= 65 ? 0.05 : 0;
  return [
    { label: `Quality score is ${score}`, amount: quality },
    { label: hasBanned ? 'Banned product used' : 'No banned products', amount: hasBanned ? 0 : 0.1 },
    { label: 'High demand in your region', amount: highDemand ? 0.1 : 0 },
  ];
}

export function fairPrice(score: number, hasBanned: boolean, highDemand = true): number {
  const sum = priceFactors(score, hasBanned, highDemand).reduce((t, f) => t + f.amount, BASE_PRICE);
  return roundPrice(sum);
}

/** AI suggested range around the fair price. */
export function suggestedRange(fair: number) {
  return { low: roundPrice(fair - 0.05), high: roundPrice(fair + 0.15) };
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
