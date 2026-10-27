import { fairPrice, offerVerdict, pctAbove, roundPrice, roundTotal, suggestedRange } from './market';

describe('market helpers', () => {
  it('rounds prices to €0.05 and totals to €50', () => {
    expect(roundPrice(0.88)).toBeCloseTo(0.9);
    expect(roundTotal(2260)).toBe(2250);
  });

  it('prices a clean high-score field at €0.90', () => {
    expect(fairPrice(86, false)).toBeCloseTo(0.9);
    expect(suggestedRange(0.9)).toEqual({ low: expect.closeTo(0.85), high: expect.closeTo(1.05) });
  });

  it('lowers the price when a banned product was used', () => {
    expect(fairPrice(68, true)).toBeLessThan(fairPrice(68, false));
  });

  it('labels offers against the fair price', () => {
    expect(offerVerdict(1, 0.9).label).toBe('Good');
    expect(offerVerdict(0.9, 0.9).label).toBe('Fair');
    expect(offerVerdict(0.7, 0.9).label).toBe('Low');
    expect(pctAbove(1, 0.9)).toBe(11);
  });
});
