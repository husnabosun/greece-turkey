import { exchangeRanges } from '../data/mock';
import { compareToRange, exchangeSpan, hasBannedLast12Months, roundPrice, roundTotal } from './market';

const range = { min: 0.75, max: 0.9, avg: 0.8 };

describe('rounding', () => {
  it('rounds prices to €0.05 and totals to €50', () => {
    expect(roundPrice(0.88)).toBe(0.9);
    expect(roundPrice(0.875)).toBe(0.9);
    expect(roundPrice(0.92)).toBe(0.9);
    expect(roundTotal(2260)).toBe(2250);
  });
});

describe('exchange range', () => {
  it('writes the range as min – max', () => {
    expect(exchangeSpan(range)).toBe('€0.75 – €0.90');
  });

  it('says within, above or below the range, and nothing else', () => {
    expect(compareToRange(0.8, range)?.label).toBe('Within range');
    expect(compareToRange(0.75, range)?.label).toBe('Within range');
    expect(compareToRange(0.9, range)?.label).toBe('Within range');
    expect(compareToRange(0.95, range)?.label).toBe('Above range');
    expect(compareToRange(0.7, range)?.label).toBe('Below range');
  });

  it('gives no verdict when the area has no exchange data', () => {
    expect(compareToRange(0.9, null)).toBeNull();
    expect(compareToRange(0.9, undefined)).toBeNull();
  });

  it('has data for the Turkish provinces of the demo and none for Greece', () => {
    expect(exchangeRanges.Aydın).toBeDefined();
    expect(exchangeRanges.Messinia).toBeUndefined();
    expect(exchangeRanges.Crete).toBeUndefined();
    for (const r of Object.values(exchangeRanges)) {
      expect(r.min).toBeLessThanOrEqual(r.avg);
      expect(r.avg).toBeLessThanOrEqual(r.max);
    }
  });
});

describe('banned products', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  const day = 86_400_000;

  it('counts a banned spray only in the last 12 months', () => {
    const sprays = [{ fieldId: 'north', banned: true, ts: now - 15 * day }];
    expect(hasBannedLast12Months(sprays, 'north', now)).toBe(true);
    expect(hasBannedLast12Months(sprays, 'river', now)).toBe(false);
    expect(hasBannedLast12Months([{ fieldId: 'north', banned: true, ts: now - 400 * day }], 'north', now)).toBe(false);
    expect(hasBannedLast12Months([{ fieldId: 'north', banned: false, ts: now - 5 * day }], 'north', now)).toBe(false);
  });
});
