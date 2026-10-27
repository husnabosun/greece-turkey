import { RISK_CONFIG as C } from './config';
import { assessField, THREATS } from './index';
import { seasonStage } from './season';
import { anthracnose } from './threats/anthracnose';
import { location } from './threats/location';
import { oliveFly } from './threats/oliveFly';
import { oliveKnot } from './threats/oliveKnot';
import { oliveMoth } from './threats/oliveMoth';
import { peacockSpot } from './threats/peacockSpot';
import { drought, frost, heat, wind } from './threats/weatherHazards';
import { around, inputFor, NO_SIGNALS } from './testUtils';
import type { SpraySignal } from './types';

const noon = (date: string) => Date.parse(`${date}T12:00:00Z`);

/** Three rainy days at 15 °C in November, wet leaves, as in the spec. */
const RAINY_NOV = (extra: Parameters<typeof around>[2] = {}) =>
  around('2026-11-10', { tMean: 15, tMin: 12, tMax: 18, wetHours: 5 }, {
    0: { rain: 8, rainyHours: 6, wetHours: 12 },
    [-1]: { rain: 10, rainyHours: 8, wetHours: 12 },
    [-2]: { rain: 6, rainyHours: 5, wetHours: 12 },
    ...extra,
  });

describe('season', () => {
  it('maps dates to stages', () => {
    expect(seasonStage('2026-01-20')).toBe('dormant');
    expect(seasonStage('2026-05-15')).toBe('flowering');
    expect(seasonStage('2026-06-20')).toBe('fruit-set');
    expect(seasonStage('2026-07-25')).toBe('pit-hardening');
    expect(seasonStage('2026-09-10')).toBe('ripening');
    expect(seasonStage('2026-11-10')).toBe('harvest');
    expect(seasonStage('2026-12-20')).toBe('dormant');
  });
});

describe('peacock spot', () => {
  it('is High after 3 rainy days at 15 °C in November', () => {
    const a = peacockSpot.assess(inputFor(RAINY_NOV()));
    expect(a.level).toBe('High');
    expect(a.drivers[0]).toMatch(/rainy day/);
  });

  it('is Low on dry, warm summer days', () => {
    const w = around('2026-08-10', { tMean: 29, tMin: 22, tMax: 35, wetHours: 0, rhMean: 45 });
    expect(peacockSpot.assess(inputFor(w)).level).toBe('Low');
  });

  it('goes up after a recent peacock spot scan', () => {
    const w = around('2026-11-10', { tMean: 15, wetHours: 5 }, { 0: { rain: 4, rainyHours: 4, wetHours: 10 } });
    const base = peacockSpot.assess(inputFor(w)).score;
    const scan = { ts: noon('2026-11-05'), mode: 'leaf' as const, title: 'Peacock spot', tone: 'high', spots: 4 };
    const withScan = peacockSpot.assess(inputFor(w, 14, { scans: [scan] }));
    expect(withScan.score).toBeGreaterThan(base + 5);
    expect(withScan.drivers.join(' ')).toMatch(/found on a scan/);
  });

  it('is lowered by a recent approved spray, and less when rain washed it off', () => {
    const w = RAINY_NOV();
    const spray: SpraySignal = { ts: noon('2026-11-06'), product: 'Copper oxychloride', targets: ['peacock-spot'], protectionDays: 14, banned: false };
    const none = peacockSpot.assess(inputFor(w)).score;
    const sprayed = peacockSpot.assess(inputFor(w, 14, { sprays: [spray] }));
    expect(sprayed.score).toBeLessThan(none);
    expect(sprayed.drivers[sprayed.drivers.length - 1]).toMatch(/Protected by copper oxychloride/);

    const washedWeather = RAINY_NOV({ [-4]: { rain: 12, rainyHours: 6, wetHours: 12 } });
    const washed = peacockSpot.assess(inputFor(washedWeather, 14, { sprays: [{ ...spray, ts: Date.parse('2026-11-06T10:00:00Z') }] }));
    const dry = peacockSpot.assess(inputFor(RAINY_NOV(), 14, { sprays: [{ ...spray, ts: Date.parse('2026-11-06T10:00:00Z') }] }));
    expect(washed.drivers[washed.drivers.length - 1]).toMatch(/washed off/);
    expect(washed.score).toBeGreaterThanOrEqual(dry.score);
  });

  it('is not lowered by a spray outside its window or by a banned product', () => {
    const w = RAINY_NOV();
    const base = peacockSpot.assess(inputFor(w)).score;
    const old: SpraySignal = { ts: noon('2026-10-01'), product: 'Copper', targets: ['peacock-spot'], protectionDays: 14, banned: false };
    const banned: SpraySignal = { ts: noon('2026-11-08'), product: 'Banned', targets: ['peacock-spot'], protectionDays: 14, banned: true };
    expect(peacockSpot.assess(inputFor(w, 14, { sprays: [old, banned] })).score).toBe(base);
  });
});

describe('olive fly', () => {
  it('is High in mild, humid weather at ripening with some flies in the trap', () => {
    const w = around('2026-10-05', { tMean: 23, tMin: 18, tMax: 28, rhMean: 80 });
    const trap = { ts: noon('2026-10-04'), mode: 'trap' as const, title: 'Fly trap', tone: 'medium', flies: 8 };
    expect(oliveFly.assess(inputFor(w, 14, { scans: [trap] })).level).toBe('High');
  });

  it('is Low on very hot, dry days', () => {
    const w = around('2026-08-20', { tMean: 33, tMin: 26, tMax: 38, rhMean: 30 });
    const a = oliveFly.assess(inputFor(w));
    expect(a.level).toBe('Low');
  });

  it('is at least Medium when a trap has more than 10 flies, even in winter', () => {
    const w = around('2026-01-20', { tMean: 9, tMin: 5, tMax: 13 });
    expect(oliveFly.assess(inputFor(w)).level).toBe('Low');
    const trap = { ts: noon('2026-01-19'), mode: 'trap' as const, title: 'Fly trap', tone: 'medium', flies: 14 };
    expect(['Medium', 'High']).toContain(oliveFly.assess(inputFor(w, 14, { scans: [trap] })).level);
  });

  it('does not use an old trap count', () => {
    const w = around('2026-10-05', { tMean: 12, tMax: 15, rhMean: 50 });
    const old = { ts: noon('2026-09-01'), mode: 'trap' as const, title: 'Fly trap', tone: 'medium', flies: 20 };
    expect(oliveFly.assess(inputFor(w, 14, { scans: [old] })).drivers.join(' ')).not.toMatch(/Trap count/);
  });

  it('is lowered by a kaolin spray', () => {
    const w = around('2026-10-05', { tMean: 23, tMax: 28, rhMean: 80 });
    const kaolin: SpraySignal = { ts: noon('2026-10-02'), product: 'Kaolin clay', targets: ['olive-fly'], protectionDays: 10, banned: false };
    expect(oliveFly.assess(inputFor(w, 14, { sprays: [kaolin] })).score).toBeLessThan(oliveFly.assess(inputFor(w)).score);
  });
});

describe('olive moth', () => {
  it('is High during flowering in mild, humid weather', () => {
    const w = around('2026-05-15', { tMean: 19, tMin: 14, tMax: 24, rhMean: 78 });
    expect(oliveMoth.assess(inputFor(w)).level).toBe('High');
  });
  it('is Low during pit hardening in hot, dry weather', () => {
    const w = around('2026-07-25', { tMean: 31, tMin: 24, tMax: 37, rhMean: 40 });
    expect(oliveMoth.assess(inputFor(w)).level).toBe('Low');
  });
});

describe('anthracnose', () => {
  it('is High in a warm, rainy week near harvest', () => {
    const w = around('2026-10-22', { tMean: 18, tMax: 22, wetHours: 10 }, { 0: { rain: 14, rainyHours: 8 }, [-1]: { rain: 12, rainyHours: 7 }, [-2]: { rain: 10, rainyHours: 6 }, [-3]: { rain: 8, rainyHours: 5 } });
    expect(anthracnose.assess(inputFor(w)).level).toBe('High');
  });
  it('is Low in a dry summer', () => {
    const w = around('2026-07-20', { tMean: 29, tMax: 34, wetHours: 0, rhMean: 45 });
    expect(anthracnose.assess(inputFor(w)).level).toBe('Low');
  });
});

describe('olive knot', () => {
  const rain12 = { 0: { rain: 12, rainyHours: 6 } };
  it('is High when it rains soon after pruning', () => {
    const w = around('2026-02-10', { tMean: 10, tMin: 6, tMax: 14 }, rain12);
    expect(oliveKnot.assess(inputFor(w, 14, { prunedDaysAgo: 2 })).level).toBe('High');
  });
  it('stays Low without any wound, even in the rain', () => {
    const w = around('2026-07-10', { tMean: 24, tMax: 30 }, rain12);
    expect(oliveKnot.assess(inputFor(w)).score).toBeLessThanOrEqual(C.oliveKnot.noWoundCap);
  });
  it('is Low when the pruning cuts are old', () => {
    const w = around('2026-03-10', { tMean: 12 }, rain12);
    expect(oliveKnot.assess(inputFor(w, 14, { prunedDaysAgo: 40 })).level).toBe('Low');
  });
  it('rises after hail-like wind or frost', () => {
    const calm = around('2026-02-10', { tMean: 10, tMin: 5 }, rain12);
    const stormy = around('2026-02-10', { tMean: 10, tMin: 5 }, { ...rain12, [-1]: { maxGust: 80 } });
    expect(oliveKnot.assess(inputFor(stormy)).score).toBeGreaterThan(oliveKnot.assess(inputFor(calm)).score);
  });
});

describe('weather hazards', () => {
  it('flags frost below 0 °C and not at 5 °C', () => {
    expect(frost.assess(inputFor(around('2026-01-15', {}, { 0: { tMin: -3 } }))).level).toBe('High');
    expect(frost.assess(inputFor(around('2026-01-15', {}, { 0: { tMin: -0.5 } }))).level).not.toBe('Low');
    expect(frost.assess(inputFor(around('2026-01-15', {}, { 0: { tMin: 5 } }))).level).toBe('Low');
  });
  it('flags heat stress above 38 °C', () => {
    expect(heat.assess(inputFor(around('2026-07-15', {}, { 0: { tMax: 42 } }))).level).toBe('High');
    expect(heat.assess(inputFor(around('2026-07-15', {}, { 0: { tMax: 30 } }))).level).toBe('Low');
  });
  it('flags strong wind above 60 km/h, and hail with heavy rain', () => {
    expect(wind.assess(inputFor(around('2026-04-15', {}, { 0: { maxGust: 85 } }))).level).toBe('High');
    const hail = wind.assess(inputFor(around('2026-04-15', {}, { 0: { maxGust: 50, rain: 15, rainyHours: 3 } })));
    expect(hail.drivers.join(' ')).toMatch(/hail/);
    expect(wind.assess(inputFor(around('2026-04-15', {}, { 0: { maxGust: 20 } }))).level).toBe('Low');
  });
  it('flags drought after many dry, hot days and keeps confidence Low', () => {
    const w = around('2026-08-10', { tMean: 30, tMax: 37, rain: 0 });
    const a = drought.assess(inputFor(w));
    expect(a.level).not.toBe('Low');
    expect(a.confidence).toBe('Low');
    expect(drought.assess(inputFor(around('2026-08-10', { tMax: 30 }, { 0: { rain: 20, rainyHours: 5 } }))).level).toBe('Low');
  });
});

describe('location risk', () => {
  const plant = { kind: 'coal-plant' as const, label: 'coal power plant', km: 4, bearingDeg: 0 };
  const north = { 0: { windHours: 10, windDir: 350, maxGust: 30 } };

  it('is High with wind from the plant on a dry day', () => {
    const a = location.assess(inputFor(around('2026-10-27', {}, north), 14, { locationRisks: [plant] }));
    expect(a.level).toBe('High');
    expect(a.drivers.join(' ')).toMatch(/Wind from the coal power plant/);
  });
  it('is Low when the wind blows from another direction', () => {
    const south = { 0: { windHours: 10, windDir: 180, maxGust: 30 } };
    expect(location.assess(inputFor(around('2026-10-27', {}, south), 14, { locationRisks: [plant] })).level).toBe('Low');
  });
  it('is lower when rain washes the ash off', () => {
    const dry = location.assess(inputFor(around('2026-10-27', {}, north), 14, { locationRisks: [plant] })).score;
    const wet = location.assess(inputFor(around('2026-10-27', {}, { 0: { ...north[0], rain: 8, rainyHours: 4 } }), 14, { locationRisks: [plant] })).score;
    expect(wet).toBeLessThan(dry);
  });
  it('is lower after the farmer marked it as done', () => {
    const w = around('2026-10-27', {}, north);
    const open = location.assess(inputFor(w, 14, { locationRisks: [plant] })).score;
    const done = location.assess(inputFor(w, 14, { locationRisks: [plant], locationMitigated: true })).score;
    expect(done).toBeLessThan(open);
  });
  it('is Low for fields with no known location risk', () => {
    expect(location.assess(inputFor(around('2026-10-27', {}, north))).level).toBe('Low');
  });
});

describe('engine', () => {
  it('assesses every threat for 7 days from today', () => {
    const w = { fieldId: 'f', fetchedAt: 0, source: 'live' as const, current: { temp: 15, rh: 70, precip: 0, code: 0, label: 'Sunny', icon: 'sunny' as const }, days: around('2026-10-27'), todayIndex: 14 };
    const risk = assessField(w, NO_SIGNALS, Date.parse('2026-10-27T12:00:00Z'));
    expect(Object.keys(risk).sort()).toEqual(THREATS.map((t) => t.id).sort());
    for (const list of Object.values(risk)) {
      expect(list).toHaveLength(7);
      expect(list[0].day).toBe('2026-10-27');
      for (const a of list) {
        expect(a.score).toBeGreaterThanOrEqual(0);
        expect(a.score).toBeLessThanOrEqual(100);
        expect(a.actions.length).toBeGreaterThan(0);
      }
    }
  });

  it('is less confident further ahead and with demo data', () => {
    const w = around('2026-10-27');
    expect(peacockSpot.assess(inputFor(w, 14)).confidence).toBe('High');
    expect(peacockSpot.assess(inputFor(w, 16)).confidence).toBe('Medium');
    expect(peacockSpot.assess(inputFor(w, 19)).confidence).toBe('Low');
    expect(peacockSpot.assess(inputFor(w, 14, {}, 'demo')).confidence).toBe('Medium');
  });

  it('never recommends a pesticide or a dose', () => {
    const forbidden = /pesticide|insecticide|fungicide|herbicide|copper|spray|kg\/ha|l\/ha|\bdose\b|\bml\b|mg\//i;
    const scenarios = [
      around('2026-11-10', { tMean: 15, wetHours: 12 }, { 0: { rain: 30, rainyHours: 12, tMin: -5, tMax: 41, maxGust: 90, windHours: 10, windDir: 0 } }),
      around('2026-05-15', { tMean: 19, rhMean: 78 }),
      around('2026-08-10', { tMean: 30, tMax: 37 }),
    ];
    const plant = { kind: 'coal-plant' as const, label: 'coal power plant', km: 4, bearingDeg: 0 };
    for (const w of scenarios) {
      for (const idx of [14, 15, 16]) {
        for (const t of THREATS) {
          const a = t.assess(inputFor(w, idx, { locationRisks: [plant], prunedDaysAgo: 3 }));
          for (const text of a.actions) expect(text).not.toMatch(forbidden);
        }
      }
    }
  });
});
