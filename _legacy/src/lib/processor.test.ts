import { deliveries, factories, farmer, fields, lots, procRequests, sales, sprays, tonsAvailable, type Delivery } from '../data/mock';
import {
  activeDeliveries,
  ANY,
  avgScore,
  buildUserLots,
  completedDeliveries,
  deliveryStepToSaleStep,
  deliveryTotal,
  expectedOilTons,
  farmersBoughtFrom,
  filterLots,
  lotHasBanned,
  NO_FILTERS,
  offerTotal,
  requestAsFactory,
  regionOf,
  requestFill,
  seasonStats,
  sprayEuStatus,
  uniqueSorted,
  weighedTons,
} from './processor';

describe('expectedOilTons', () => {
  it('uses 18 % for oil olives and nothing for table olives', () => {
    expect(expectedOilTons(10, 'oil')).toBe(1.8);
    expect(expectedOilTons(2.5, 'oil')).toBe(0.45);
    expect(expectedOilTons(10, 'table')).toBe(0);
  });
});

describe('offerTotal and avgScore', () => {
  it('rounds totals to €50', () => {
    expect(offerTotal(2.5, 0.95)).toBe(2400);
    expect(offerTotal(6, 0.95)).toBe(5700);
  });
  it('averages scores, and handles an empty list', () => {
    expect(avgScore([88, 82, 77])).toBe(82);
    expect(avgScore([])).toBe(0);
  });
});

describe('sprayEuStatus', () => {
  it('flags a spray the farmer marked as banned', () => {
    expect(sprayEuStatus({ product: 'Some product', banned: true }).banned).toBe(true);
  });
  it('finds a substance that is not approved in the EU, in the substances or the product name', () => {
    expect(sprayEuStatus({ product: 'Product A', banned: false, activeSubstances: ['Dimethoate'] })).toEqual({ banned: true, hits: ['dimethoate'] });
    expect(sprayEuStatus({ product: 'Chlorpyrifos product', banned: false }).hits).toEqual(['chlorpyrifos']);
  });
  it('passes copper and kaolin', () => {
    expect(sprayEuStatus({ product: 'Copper oxychloride', banned: false, activeSubstances: ['copper oxychloride'] }).banned).toBe(false);
    expect(sprayEuStatus({ product: 'Kaolin clay', banned: false }).banned).toBe(false);
  });
});

describe('filterLots', () => {
  it('returns everything without filters', () => {
    expect(filterLots(lots, NO_FILTERS)).toHaveLength(lots.length);
  });
  it('filters by variety, region and minimum score together', () => {
    const out = filterLots(lots, { ...NO_FILTERS, variety: 'Ayvalık', region: 'Balıkesir', minScore: 85 });
    expect(out.map((l) => l.id)).toEqual(['lot-ay1']);
  });
  it('hides lots with a banned product when "no banned products" is on', () => {
    expect(lots.some(lotHasBanned)).toBe(true);
    const out = filterLots(lots, { ...NO_FILTERS, noBanned: true });
    expect(out.every((l) => !lotHasBanned(l))).toBe(true);
    expect(out.find((l) => l.id === 'lot-ay4')).toBeUndefined();
  });
  it('filters by use', () => {
    expect(filterLots(lots, { ...NO_FILTERS, use: 'table' }).every((l) => l.use === 'table')).toBe(true);
    expect(filterLots(lots, { ...NO_FILTERS, use: ANY })).toHaveLength(lots.length);
  });
  it('lists each option once, sorted', () => {
    expect(uniqueSorted(['b', 'a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('buildUserLots', () => {
  const build = (over: Partial<Parameters<typeof buildUserLots>[0]> = {}) =>
    buildUserLots({ fields, sprays, sales, listings: [], farmerName: farmer.name, place: farmer.place, defaultTons: tonsAvailable, ...over });

  it('makes one lot per field with the live score and region', () => {
    const out = build();
    expect(out.map((l) => l.id)).toEqual(fields.map((f) => f.id));
    expect(out[0]).toMatchObject({ town: 'Germencik', region: 'Aydın', score: fields[0].score, use: 'oil' });
  });
  it('shows a banned spray of North grove, and no banned product on River plot', () => {
    const out = build();
    expect(lotHasBanned(out.find((l) => l.id === 'north')!)).toBe(true);
    expect(lotHasBanned(out.find((l) => l.id === 'river')!)).toBe(false);
  });
  it('uses the tons of a listing', () => {
    const out = build({ listings: [{ fieldId: 'river', tons: 4, pricePerKg: 0.9 }] });
    expect(out.find((l) => l.id === 'river')!.tons).toBe(4);
  });
  it('takes the lab result from a paid sale that passed the lab', () => {
    expect(build().find((l) => l.id === 'hill')!.lab).toMatchObject({ result: 'passed' });
  });
});

describe('requests', () => {
  it('computes the fill share and caps it at 100', () => {
    expect(requestFill({ tons: 20, filledTons: 8.5 })).toBe(43);
    expect(requestFill({ tons: 10, filledTons: 12 })).toBe(100);
  });
  it('turns a request into a factory request for the farmer app', () => {
    const buyer = factories.find((f) => f.id === 'demo')!;
    const f = requestAsFactory({ ...procRequests[0], window: '5–25 Nov' }, buyer);
    expect(f).toMatchObject({ id: 'demo', variety: 'Ayvalık', minScore: 75, harvestBy: '25 Nov', requests: true, noBanned: true });
    expect(f.needsTons).toBe(11.5);
    expect(requestAsFactory({ ...procRequests[2] }, buyer).harvestBy).toBe('5 Dec');
  });
});

describe('deliveryStepToSaleStep', () => {
  it('maps delivery steps to the five sale steps', () => {
    expect([0, 1, 2, 3, 4].map(deliveryStepToSaleStep)).toEqual([0, 2, 3, 4, 4]);
  });
});

describe('purchase history', () => {
  const paid = (over: Partial<Delivery>): Delivery => ({
    id: 'x',
    farmerName: 'A',
    place: 'Town, Aydın',
    variety: 'Ayvalık',
    tons: 1,
    pricePerKg: 1,
    scheduledIn: -5,
    step: 4,
    paidDate: '10 Oct 2026',
    paidAgo: 10,
    score: 80,
    ...over,
  });

  it('weighs by the weighbridge result and rounds each total to €50', () => {
    expect(weighedTons({ tons: 4.2, actualKg: 4180 })).toBe(4.18);
    expect(weighedTons({ tons: 4.2 })).toBe(4.2);
    expect(deliveryTotal({ tons: 4.2, actualKg: 4180, pricePerKg: 0.85 })).toBe(3550);
  });

  it('adds up the season: tonnes, spent, average score and share without banned products', () => {
    const list = [
      paid({ id: 'a', actualKg: 4000, pricePerKg: 0.9, score: 90 }),
      paid({ id: 'b', actualKg: 2910, pricePerKg: 0.75, score: 60, bannedFree: false }),
      paid({ id: 'c', actualKg: 3000, pricePerKg: 1, score: 75 }),
      paid({ id: 'd', actualKg: 5000, pricePerKg: 1, score: 100, paidDate: '3 Dec 2025' }),
      paid({ id: 'e', step: 2, actualKg: 9000, paidDate: undefined }),
    ];
    expect(seasonStats(list, 2026)).toEqual({ deliveries: 3, tons: 9.9, spent: 3600 + 2200 + 3000, avgScore: 75, cleanShare: 67 });
    expect(seasonStats(list, 2025)).toMatchObject({ deliveries: 1, tons: 5, spent: 5000, avgScore: 100, cleanShare: 100 });
  });

  it('has zeros for a season without purchases', () => {
    expect(seasonStats([], 2026)).toEqual({ deliveries: 0, tons: 0, spent: 0, avgScore: 0, cleanShare: 0 });
    expect(seasonStats(deliveries, 2020).deliveries).toBe(0);
  });

  it('the seeded 2026 season adds up to the numbers on the screen', () => {
    // 8 paid deliveries (6000 + 3550 + 5250 + 6750 + 2900 + 7950 + 2200 + 3100 = 37700 euro): 6.02 + 4.18 + 5.53 + 6.76 + 3.21 + 8.39 + 2.91 + 3.62 t, one with a banned product.
    expect(seasonStats(deliveries, 2026)).toEqual({ deliveries: 8, tons: 40.6, spent: 37700, avgScore: 80, cleanShare: 88 });
  });

  it('lists paid deliveries newest first and keeps the others active', () => {
    const done = completedDeliveries(deliveries);
    expect(done).toHaveLength(8);
    expect(done[0].id).toBe('d4');
    expect(done.map((d) => d.paidAgo)).toEqual([...done.map((d) => d.paidAgo)].sort((a, b) => a! - b!));
    expect(activeDeliveries(deliveries).map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it('groups the farmers bought from, most deliveries first', () => {
    const farmers = farmersBoughtFrom(completedDeliveries(deliveries));
    expect(farmers).toHaveLength(7);
    expect(farmers[0]).toMatchObject({ farmerName: 'Hasan Çelik', deliveries: 2, avgScore: 77, region: 'Aydın', variety: 'Memecik' });
    expect(farmers.find((f) => f.farmerName === 'Osman Tekin')).toMatchObject({ deliveries: 1, avgScore: 74 });
    expect(farmers.find((f) => f.farmerName === 'Dimitris Kalogeras')!.region).toBe('Messinia');
  });

  it('finds the region of a place', () => {
    expect(regionOf('Nazilli, Aydın')).toBe('Aydın');
    expect(regionOf('Messinia')).toBe('Messinia');
  });
});
