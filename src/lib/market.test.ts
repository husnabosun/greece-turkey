import { fairPrice, fittingRequests, hasBannedLast12Months, offerVerdict, pctAbove, priceFactors, roundPrice, roundTotal, suggestedRange, type PriceInput } from './market';

const exchange = { pricePerKg: 0.8, source: 'Aegean olive exchange', date: '29 Oct' };
const input = (over: Partial<PriceInput> = {}): PriceInput => ({ score: 86, hasBanned: false, fittingRequests: 2, exchange, ...over });
const total = (i: PriceInput) => Math.round(priceFactors(i).reduce((t, l) => t + l.amount * 100, 0)) / 100;

describe('rounding', () => {
  it('rounds prices to €0.05 and totals to €50', () => {
    expect(roundPrice(0.88)).toBe(0.9);
    expect(roundPrice(0.875)).toBe(0.9);
    expect(roundPrice(0.92)).toBe(0.9);
    expect(roundTotal(2260)).toBe(2250);
  });
});

describe('fair price', () => {
  it('starts from the exchange price, with the source and date in the first line', () => {
    const [base] = priceFactors(input());
    expect(base.kind).toBe('base');
    expect(base.amount).toBe(0.8);
    expect(base.label).toBe('Exchange price today · Aegean olive exchange · 29 Oct');
  });

  it('adds quality: score 86 gives +€0.08, score 60 gives −€0.05', () => {
    const q = (score: number) => priceFactors(input({ score })).find((l) => l.label.startsWith('Quality'))?.amount;
    expect(q(86)).toBe(0.08);
    expect(q(60)).toBe(-0.05);
    expect(q(70)).toBeUndefined();
  });

  it('adds +€0.03 for no banned products and −€0.05 for a banned product', () => {
    const b = (hasBanned: boolean) => priceFactors(input({ hasBanned })).find((l) => /banned/i.test(l.label))?.amount;
    expect(b(false)).toBe(0.03);
    expect(b(true)).toBe(-0.05);
  });

  it('adds €0.02 per fitting request, at most €0.05, and no line without requests', () => {
    const d = (fittingRequests: number) => priceFactors(input({ fittingRequests })).find((l) => /request/.test(l.label))?.amount;
    expect(d(0)).toBeUndefined();
    expect(d(1)).toBe(0.02);
    expect(d(2)).toBe(0.04);
    expect(d(3)).toBe(0.05);
    expect(d(9)).toBe(0.05);
  });

  it('is the sum of the lines, rounded to €0.05', () => {
    // 0.80 + 0.08 + 0.03 + 0.04 = 0.95
    expect(fairPrice(input())).toBe(0.95);
    // 0.80 − 0.01 (score 68) − 0.05 (banned) = 0.74 -> 0.75
    expect(fairPrice(input({ score: 68, hasBanned: true, fittingRequests: 0 }))).toBe(0.75);
  });

  it('always has lines that add up exactly to the fair price', () => {
    for (const score of [40, 55, 60, 68, 70, 75, 81, 86, 92, 100]) {
      for (const hasBanned of [false, true]) {
        for (const fittingRequests of [0, 1, 2, 3, 5]) {
          const i = input({ score, hasBanned, fittingRequests });
          const fair = fairPrice(i);
          expect(total(i)).toBe(fair);
          expect(roundPrice(fair)).toBe(fair);
        }
      }
    }
  });

  it('shows a rounding line only when needed', () => {
    const lines = priceFactors(input({ score: 68, hasBanned: true, fittingRequests: 0 }));
    expect(lines.find((l) => l.label === 'Rounded to €0.05')?.amount).toBe(0.01);
    expect(priceFactors(input()).some((l) => l.label.startsWith('Rounded'))).toBe(false);
  });

  it('lowers the price when a banned product was used', () => {
    expect(fairPrice(input({ hasBanned: true }))).toBeLessThan(fairPrice(input({ hasBanned: false })));
  });

  it('gives a range of fair ± €0.05', () => {
    expect(suggestedRange(0.95)).toEqual({ low: 0.9, high: 1 });
  });
});

describe('inputs of the fair price', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  const day = 86_400_000;

  it('counts a banned spray only in the last 12 months', () => {
    const sprays = [{ fieldId: 'north', banned: true, ts: now - 15 * day }];
    expect(hasBannedLast12Months(sprays, 'north', now)).toBe(true);
    expect(hasBannedLast12Months(sprays, 'river', now)).toBe(false);
    expect(hasBannedLast12Months([{ fieldId: 'north', banned: true, ts: now - 400 * day }], 'north', now)).toBe(false);
    expect(hasBannedLast12Months([{ fieldId: 'north', banned: false, ts: now - 5 * day }], 'north', now)).toBe(false);
  });

  it('counts the open requests that fit a field', () => {
    const f = [
      { minScore: 75, noBanned: true, requests: true },
      { minScore: 80, noBanned: false, requests: true },
      { minScore: 60, noBanned: false, requests: false },
    ];
    expect(fittingRequests(f, 86, false)).toBe(2);
    expect(fittingRequests(f, 86, true)).toBe(1);
    expect(fittingRequests(f, 70, false)).toBe(0);
  });
});

describe('offers', () => {
  it('labels offers against the fair price', () => {
    expect(offerVerdict(1, 0.9).label).toBe('Good');
    expect(offerVerdict(0.9, 0.9).label).toBe('Fair');
    expect(offerVerdict(0.7, 0.9).label).toBe('Low');
    expect(pctAbove(1, 0.9)).toBe(11);
  });
});
