import { CACHE_MS, demoWeather, describeWeather, forecastUrl, getFieldWeather, parseOpenMeteo, rainWithinHours, type FieldWeather, type WeatherStorage } from './weather';

const FIELD = { id: 'north', lat: 39.33, lon: 26.7 };

/** A small Open-Meteo style response: 3 days, two with rain, UTC+3. */
function fixture() {
  const dates = ['2026-10-25', '2026-10-26', '2026-10-27'];
  const time: string[] = [];
  const temp: number[] = [];
  const rh: number[] = [];
  const precip: number[] = [];
  const gust: number[] = [];
  const dew: number[] = [];
  const dir: number[] = [];
  dates.forEach((d, di) => {
    for (let h = 0; h < 24; h++) {
      time.push(`${d}T${String(h).padStart(2, '0')}:00`);
      temp.push(10 + (h >= 12 ? 8 : 0) + di);
      // Day 2 has 14 humid hours (> 90 %).
      rh.push(di === 1 && h < 14 ? 95 : 70);
      // Day 2: 1 mm per hour from 14:00 to 18:00 (4 mm). Day 3: 0.05 mm drizzle all day (not a rainy hour).
      precip.push(di === 1 && h >= 14 && h < 18 ? 1 : di === 2 ? 0.05 : 0);
      gust.push(20 + h);
      dew.push(5);
      dir.push(350);
    }
  });
  return {
    utc_offset_seconds: 10800,
    current: { time: '2026-10-27T20:00', temperature_2m: 14, relative_humidity_2m: 81, precipitation: 0.1, weather_code: 80 },
    hourly: { time, temperature_2m: temp, relative_humidity_2m: rh, precipitation: precip, wind_gusts_10m: gust, dew_point_2m: dew, wind_direction_10m: dir },
    daily: {
      time: dates,
      temperature_2m_max: [18, 19, 20],
      temperature_2m_min: [10, 11, 12],
      precipitation_sum: [0, 4, 1.2],
      wind_gusts_10m_max: [43, 43, 43],
    },
  };
}

describe('weather', () => {
  it('builds the request URL with the requested variables', () => {
    const url = forecastUrl(FIELD);
    expect(url).toContain('latitude=39.33&longitude=26.7&past_days=14&forecast_days=7&timezone=auto');
    expect(url).toContain('daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max');
    expect(url).toContain('current=temperature_2m,relative_humidity_2m,precipitation,weather_code');
    expect(url).toContain('relative_humidity_2m');
  });

  it('derives mean/min/max, rain, rainy hours, wet hours and gusts per day', () => {
    const w = parseOpenMeteo(fixture(), 'north', 1000);
    expect(w.days).toHaveLength(3);
    expect(w.todayIndex).toBe(2);
    expect(w.source).toBe('live');
    const d = w.days[1];
    expect(d.rain).toBe(4);
    expect(d.rainyHours).toBe(4);
    expect(d.wetHours).toBe(14);
    expect(d.tMax).toBe(19);
    expect(d.tMin).toBe(11);
    expect(d.tMean).toBeCloseTo(15, 5);
    expect(d.maxGust).toBe(43);
    expect(d.forecast).toBe(false);
    // Drizzle under 0.1 mm per hour does not count as a rainy hour.
    expect(w.days[2].rainyHours).toBe(0);
    expect(w.current.label).toBe('Rain');
  });

  it('turns local hourly times into instants', () => {
    const w = parseOpenMeteo(fixture(), 'north');
    // 2026-10-26 14:00 at UTC+3 is 11:00 UTC.
    expect(w.days[1].hours[14].ts).toBe(Date.parse('2026-10-26T11:00:00Z'));
  });

  it('adds up rain after a time with rainWithinHours', () => {
    const w = parseOpenMeteo(fixture(), 'north');
    const at = (iso: string) => Date.parse(iso);
    expect(rainWithinHours(w, at('2026-10-26T11:00:00Z'), 4)).toBeCloseTo(4, 5);
    expect(rainWithinHours(w, at('2026-10-26T11:00:00Z'), 2)).toBeCloseTo(2, 5);
    expect(rainWithinHours(w, at('2026-10-25T21:00:00Z'), 6)).toBeCloseTo(0, 5);
    // Outside the data: unknown, not zero.
    expect(rainWithinHours(w, at('2026-09-01T00:00:00Z'), 24)).toBeNull();
    expect(rainWithinHours(w, at('2026-10-27T10:00:00Z'), 48)).toBeNull();
  });

  it('maps weather codes to a label and icon', () => {
    expect(describeWeather(0)).toEqual({ label: 'Sunny', icon: 'sunny' });
    expect(describeWeather(3)).toEqual({ label: 'Cloudy', icon: 'cloudy' });
    expect(describeWeather(63)).toEqual({ label: 'Rain', icon: 'rain' });
    expect(describeWeather(81)).toEqual({ label: 'Rain', icon: 'rain' });
    expect(describeWeather(95)).toEqual({ label: 'Storm', icon: 'storm' });
  });

  it('rejects a response that is not a forecast', () => {
    expect(() => parseOpenMeteo({ error: true }, 'x')).toThrow();
  });
});

describe('demo weather', () => {
  it('has 21 days with today at index 14 and is marked demo', () => {
    const w = demoWeather(FIELD, Date.parse('2026-10-27T10:00:00Z'));
    expect(w.source).toBe('demo');
    expect(w.days).toHaveLength(21);
    expect(w.todayIndex).toBe(14);
    expect(w.days.every((d) => d.hours.length === 24)).toBe(true);
    expect(w.days.slice(15).every((d) => d.forecast)).toBe(true);
  });
});

describe('cache and fallback', () => {
  const makeStorage = () => {
    const data = new Map<string, string>();
    const storage: WeatherStorage = { getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
    return { storage, data };
  };
  const okFetch = (calls: { n: number }) =>
    (async () => {
      calls.n++;
      return { ok: true, json: async () => fixture() } as Response;
    }) as unknown as typeof fetch;
  const failFetch = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;

  it('fetches live, then serves the cache for one hour, then refreshes', async () => {
    const { storage } = makeStorage();
    const memory = new Map<string, FieldWeather>();
    const calls = { n: 0 };
    const deps = { fetchImpl: okFetch(calls), storage, memory };

    const first = await getFieldWeather(FIELD, { ...deps, now: 1_000 });
    expect(first.source).toBe('live');
    const second = await getFieldWeather(FIELD, { ...deps, now: 1_000 + CACHE_MS - 1 });
    expect(second.source).toBe('cached');
    expect(calls.n).toBe(1);
    const third = await getFieldWeather(FIELD, { ...deps, now: 1_000 + CACHE_MS + 1 });
    expect(third.source).toBe('live');
    expect(calls.n).toBe(2);
  });

  it('uses the stored cache after a restart, even when the network is down', async () => {
    const { storage } = makeStorage();
    await getFieldWeather(FIELD, { fetchImpl: okFetch({ n: 0 }), storage, memory: new Map(), now: 1_000 });
    const later = await getFieldWeather(FIELD, { fetchImpl: failFetch, storage, memory: new Map(), now: 1_000 + 5 * CACHE_MS });
    expect(later.source).toBe('cached');
    expect(later.days).toHaveLength(3);
  });

  it('falls back to demo data when there is no cache and no network', async () => {
    const { storage } = makeStorage();
    const w = await getFieldWeather(FIELD, { fetchImpl: failFetch, storage, memory: new Map(), now: 1_000 });
    expect(w.source).toBe('demo');
  });

  it('treats a bad response like a failure', async () => {
    const bad = (async () => ({ ok: true, json: async () => ({ nope: 1 }) }) as Response) as unknown as typeof fetch;
    const w = await getFieldWeather(FIELD, { fetchImpl: bad, memory: new Map(), now: 1_000 });
    expect(w.source).toBe('demo');
  });
});
