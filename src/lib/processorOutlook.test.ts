import { areas, deliveries, lots, type Lot } from '../data/mock';
import { trustBadges } from './badges';
import { assessField, LEVEL_RANK } from './risk';
import { demoWeather } from './weather';
import type { Assessment, FieldRisk } from './risk';
import type { AreaRisk } from './processor';

const NO_SIGNALS = { scans: [], sprays: [], locationRisks: [], locationMitigated: false };
import {
  areaDemoWeather,
  filterLots,
  harvestLabel,
  harvestWindow,
  labAdvice,
  lotBadgeList,
  lotBadges,
  lotRisk,
  lotSignals,
  NO_FILTERS,
  placeLabel,
  RECORDS_INCOMPLETE_BELOW,
  regionOf,
  rowBadges,
  summarizeRisk,
  varietyLabel,
  weekLabel,
  weeklySupply,
} from './processor';

const lot = (over: Partial<Lot>): Lot => ({ ...lots[0], ...over });

describe('weeklySupply', () => {
  it('spreads the tonnes of a lot evenly over its harvest window', () => {
    // 14 tonnes over days 0-13: 7 tonnes in week 1 and 7 in week 2.
    const out = weeklySupply([{ region: 'Aydın', tons: 14, harvestIn: [0, 13] }], ['Aydın']);
    expect(out.Aydın).toEqual([7, 7, 0, 0]);
  });
  it('splits a window that crosses a week', () => {
    // days 5-8 is 4 days: 2 in week 1 (days 5, 6) and 2 in week 2 (days 7, 8).
    expect(weeklySupply([{ region: 'Crete', tons: 8, harvestIn: [5, 8] }], ['Crete']).Crete).toEqual([4, 4, 0, 0]);
  });
  it('adds lots of the same region and leaves out other regions and days after week 4', () => {
    const out = weeklySupply(
      [
        { region: 'Aydın', tons: 7, harvestIn: [0, 6] },
        { region: 'Aydın', tons: 3, harvestIn: [0, 6] },
        { region: 'İzmir', tons: 5, harvestIn: [28, 34] },
        { region: 'Messinia', tons: 9, harvestIn: [0, 6] },
      ],
      ['Aydın', 'İzmir'],
    );
    expect(out).toEqual({ Aydın: [10, 0, 0, 0], İzmir: [0, 0, 0, 0] });
  });
  it('rounds to one decimal', () => {
    expect(weeklySupply([{ region: 'Aydın', tons: 1, harvestIn: [0, 2] }], ['Aydın']).Aydın[0]).toBe(1);
    expect(weeklySupply([{ region: 'Aydın', tons: 1, harvestIn: [5, 11] }], ['Aydın']).Aydın).toEqual([0.3, 0.7, 0, 0]);
  });
  it('covers every region of the outlook with the mock lots', () => {
    const out = weeklySupply(lots, areas.map((a) => a.region));
    expect(Object.keys(out)).toEqual(['Aydın', 'Balıkesir', 'İzmir', 'Crete', 'Messinia']);
    expect(Object.values(out).every((w) => w.length === 4)).toBe(true);
    expect(out.Balıkesir.reduce((t, n) => t + n, 0)).toBeGreaterThan(0);
  });
});

describe('summarizeRisk', () => {
  const a = (threat: Assessment['threat'], score: number, level: Assessment['level']): Assessment => ({ threat, day: '2026-11-01', score, level, drivers: [], actions: [], confidence: 'High' });
  const risk = (list: Assessment[]) => Object.fromEntries(list.map((x) => [x.threat, [x]])) as unknown as FieldRisk;

  it('names the most serious pest when the risk is high', () => {
    expect(summarizeRisk(risk([a('peacock-spot', 80, 'High'), a('olive-fly', 40, 'Medium')]))).toEqual({
      level: 'High',
      threat: 'Peacock spot',
      line: 'Peacock spot risk high this week: check lots before buying',
    });
  });
  it('asks for spray records when the risk is medium', () => {
    const r = summarizeRisk(risk([a('olive-fly', 50, 'Medium')]));
    expect(r.level).toBe('Medium');
    expect(r.line).toBe('Olive fly risk medium this week: ask for spray records');
  });
  it('is low when nothing is raised, and ignores weather hazards', () => {
    expect(summarizeRisk(risk([a('olive-fly', 10, 'Low'), a('frost', 90, 'High')])).level).toBe('Low');
    expect(summarizeRisk(risk([])).line).toContain('Low risk');
  });
});

describe('labAdvice', () => {
  const clean = { breakdown: { tree: 80, spray: 80, harvest: 80, records: 85 } } as Pick<Lot, 'breakdown' | 'lab'>;
  const high: AreaRisk = { level: 'High', threat: 'Peacock spot', line: '' };
  const lab = { result: 'passed' as const, date: '1 Oct' };

  it('suggests no test for complete records and a low or medium risk', () => {
    expect(labAdvice(clean, { level: 'Low', threat: null, line: '' })).toEqual({ suggested: false, reasons: [] });
    expect(labAdvice(clean, { level: 'Medium', threat: 'Olive fly', line: '' }).suggested).toBe(false);
    expect(labAdvice(clean, null).suggested).toBe(false);
  });
  it('suggests a test for a high risk in the area when the lot has no lab result, and says why in one line', () => {
    expect(labAdvice(clean, high).reasons).toEqual(['High peacock spot risk in this area and no lab result yet']);
  });
  it('does not suggest a test for a high risk when the lot already has a lab result', () => {
    expect(labAdvice({ ...clean, lab }, high).suggested).toBe(false);
  });
  it('suggests a test for incomplete spray records, whatever the risk', () => {
    const out = labAdvice({ ...clean, breakdown: { ...clean.breakdown, records: 66 } }, { level: 'Low', threat: null, line: '' });
    expect(out.reasons).toEqual(['Spray records are incomplete (records score 66%)']);
    expect(labAdvice({ ...clean, breakdown: { ...clean.breakdown, records: RECORDS_INCOMPLETE_BELOW } }, null).suggested).toBe(false);
  });
  it('gives both reasons when both apply', () => {
    expect(labAdvice({ ...clean, breakdown: { ...clean.breakdown, records: 60 } }, high).reasons).toHaveLength(2);
  });
  it('filters the lots with a suggested lab test', () => {
    const suggested = (l: Lot) => labAdvice(l, null).suggested;
    const out = filterLots(lots, { ...NO_FILTERS, labSuggested: true }, suggested);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((l) => l.breakdown.records < RECORDS_INCOMPLETE_BELOW)).toBe(true);
    expect(filterLots(lots, NO_FILTERS, suggested)).toHaveLength(lots.length);
  });

  describe('with the mock lots and the demo weather of the areas', () => {
    // The demo weather follows the season, so the check is pinned to the submission week.
    const now = new Date(2026, 9, 31, 10).getTime();
    const risks = Object.fromEntries(areas.map((a) => [a.region, summarizeRisk(assessField(areaDemoWeather(a, now), NO_SIGNALS, now, 7))]));
    const advice = (l: Lot) => labAdvice(l, risks[l.region]);

    it('gives a realistic mix of risk levels', () => {
      expect(Object.fromEntries(Object.entries(risks).map(([k, v]) => [k, v.level]))).toEqual({ Aydın: 'Medium', Balıkesir: 'High', İzmir: 'Low', Crete: 'Medium', Messinia: 'Low' });
    });
    it('suggests a lab test for only about a quarter of the lots (3 of 9 other lots)', () => {
      expect(lots.filter((l) => advice(l).suggested).map((l) => l.id)).toEqual(['lot-ay2', 'lot-ay4', 'lot-ay6']);
    });
    it('never shows Lab test suggested and Complete records for the same reason', () => {
      for (const l of lots) {
        const ids = lotBadgeList(lotBadges(l, deliveries), advice(l), false).map((b) => b.id);
        if (advice(l).reasons.some((r) => r.startsWith('Spray records'))) expect(ids).not.toContain('complete-records');
      }
    });
  });
});

describe('lotBadgeList and rowBadges', () => {
  const trust = trustBadges({ records: 90, hasBanned: false, paidDeliveries: 2, labFailed: 0 });
  const suggested = { suggested: true, reasons: ['x'] };
  const none = { suggested: false, reasons: [] };

  it('orders: Lab test suggested, No banned products, Reliable delivery, Complete records', () => {
    expect(lotBadgeList(trust, suggested).map((b) => b.id)).toEqual(['lab-suggested', 'no-banned', 'reliable-delivery', 'complete-records']);
  });
  it('shows at most 2 badges in a row and counts the rest', () => {
    const list = lotBadgeList(trust, suggested);
    const row = rowBadges(list);
    expect(row.shown.map((b) => b.id)).toEqual(['lab-suggested', 'no-banned']);
    expect(row.more).toBe(2);
    expect(rowBadges(lotBadgeList(trust, none)).more).toBe(1);
    expect(rowBadges(lotBadgeList(trust.slice(0, 1), none))).toEqual({ shown: trust.slice(0, 1), more: 0 });
  });
  it('shows Banned product used in the place of No banned products', () => {
    const ids = lotBadgeList(trustBadges({ records: 90, hasBanned: true, paidDeliveries: 0, labFailed: 0 }), none, true).map((b) => b.id);
    expect(ids).toEqual(['banned', 'complete-records']);
  });
});

describe('lotRisk', () => {
  const now = Date.now();
  const point = { id: 'area:test', lat: 39.32, lon: 26.69 };
  const spray = (product: string, daysAgo: number, banned = false) => ({
    product,
    date: 'x',
    ts: now - daysAgo * 86_400_000,
    banned,
    targets: ['peacock-spot', 'anthracnose', 'olive-knot'] as Lot['sprays'][number]['targets'],
    protectionDays: 14,
  });

  it('turns the sprays of a lot into engine signals', () => {
    const signals = lotSignals({ sprays: [spray('Copper oxychloride', 2)] });
    expect(signals.sprays).toEqual([{ ts: now - 2 * 86_400_000, product: 'Copper oxychloride', targets: ['peacock-spot', 'anthracnose', 'olive-knot'], protectionDays: 14, banned: false }]);
    expect(signals.scans).toEqual([]);
  });
  it('is never higher for a lot with a recent approved spray than for one without sprays', () => {
    const w = demoWeather(point, now);
    const none = lotRisk({ sprays: [] }, w, now);
    const protectedLot = lotRisk({ sprays: [spray('Copper oxychloride', 2)] }, w, now);
    expect(LEVEL_RANK[protectedLot.level]).toBeLessThanOrEqual(LEVEL_RANK[none.level]);
  });
  it('does not count a spray whose protection has ended', () => {
    const w = demoWeather(point, now);
    expect(lotRisk({ sprays: [spray('Copper oxychloride', 60)] }, w, now)).toEqual(lotRisk({ sprays: [] }, w, now));
  });
});

describe('lotBadges', () => {
  it('earns Reliable delivery from the paid deliveries of the farmer', () => {
    const l = lots.find((x) => x.farmerName === 'Ayşe Kaya')!;
    expect(lotBadges(l, deliveries).map((b) => b.id)).toContain('reliable-delivery');
    const other = lots.find((x) => x.farmerName === 'Ali Demir')!;
    expect(lotBadges(other, deliveries).map((b) => b.id)).not.toContain('reliable-delivery');
  });
  it('gives no No banned products badge to a lot with a banned spray', () => {
    const l = lots.find((x) => x.id === 'lot-ay4')!;
    expect(lotBadges(l, deliveries).map((b) => b.id)).not.toContain('no-banned');
  });
});

describe('names and places', () => {
  it('shows the district and the province, and says "olives" for a variety', () => {
    const ayvalik = lots.find((l) => l.id === 'lot-ay2')!;
    expect(ayvalik.variety).toBe('Ayvalık');
    expect(placeLabel(ayvalik)).toBe('Ayvalık, Balıkesir');
    expect(varietyLabel(ayvalik.variety)).toBe('Ayvalık olives');
  });
  it('labels the harvest window from the days', () => {
    const now = new Date(2026, 9, 31);
    expect(harvestLabel({ harvestIn: [5, 12] }, now)).toBe('5–12 Nov');
    expect(harvestLabel({ harvestIn: [20, 31] }, now)).toBe('20 Nov–1 Dec');
    expect(harvestLabel({ harvestIn: [0, 10] }, now)).toBe('Now');
    expect(weekLabel(0, now)).toBe('31 Oct–6 Nov');
    expect(weekLabel(1, now)).toBe('7–13 Nov');
  });
  it('makes a 10 day window for a field that is ready or a number of days away', () => {
    expect(harvestWindow({ ready: true, badge: 'Now' })).toEqual([0, 10]);
    expect(harvestWindow({ ready: false, badge: '12 days' })).toEqual([12, 22]);
  });

  // Every lot and delivery needs a district that really belongs to its province.
  const DISTRICTS: Record<string, string[]> = {
    Balıkesir: ['Edremit', 'Ayvalık', 'Burhaniye', 'Gömeç', 'Havran'],
    Aydın: ['Germencik', 'Nazilli', 'Söke', 'Koçarlı', 'Didim', 'Kuşadası'],
    İzmir: ['Bergama', 'Ödemiş', 'Tire', 'Menderes'],
    Messinia: ['Kalamata', 'Pylos', 'Oichalia', 'Trifylia'],
    Crete: ['Chania', 'Heraklion', 'Rethymno'],
  };
  it('every mock lot has a realistic district for its province', () => {
    for (const l of lots) expect(DISTRICTS[l.region]).toContain(l.town);
  });
  it('every mock delivery has a district and a province that belong together', () => {
    for (const d of deliveries) {
      const [district, province] = d.place.split(',').map((x) => x.trim());
      expect(province).toBeDefined();
      expect(DISTRICTS[province]).toContain(district);
      expect(regionOf(d.place)).toBe(province);
    }
  });
  it('the weather areas are exactly the five provinces of the outlook', () => {
    expect(areas.map((a) => a.region)).toEqual(['Aydın', 'Balıkesir', 'İzmir', 'Crete', 'Messinia']);
    expect(new Set(lots.map((l) => l.region)).size).toBeLessThanOrEqual(areas.length);
  });
});
