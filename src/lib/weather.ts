/**
 * Weather for a field: Open-Meteo (free, no API key), derived per-day numbers, a 1-hour cache,
 * and a demo fallback. Pure TS with injected `fetch` and `storage`, so it is easy to test.
 */

export type WeatherSource = 'live' | 'cached' | 'demo';
export type WeatherIcon = 'sunny' | 'cloudy' | 'rain' | 'storm';

export interface HourlyPoint {
  time: string;
  /** Instant in milliseconds. */
  ts: number;
  temp: number;
  rh: number;
  precip: number;
  gust: number;
  dew: number;
  /** Direction the wind blows FROM, in degrees (0 = north). */
  windDir: number | null;
}

export interface DayWeather {
  /** Local date, "YYYY-MM-DD". */
  date: string;
  tMean: number;
  tMin: number;
  tMax: number;
  /** Rain total, mm. */
  rain: number;
  /** Hours with at least RAINY_HOUR_MM of rain. */
  rainyHours: number;
  /** Hours with relative humidity above WET_HOUR_RH, a proxy for leaf wetness. */
  wetHours: number;
  /** Strongest wind gust, km/h. */
  maxGust: number;
  /** Mean relative humidity, %. */
  rhMean: number;
  /** After today. */
  forecast: boolean;
  hours: HourlyPoint[];
}

export interface CurrentWeather {
  temp: number;
  rh: number;
  precip: number;
  code: number;
  label: string;
  icon: WeatherIcon;
}

export interface FieldWeather {
  fieldId: string;
  fetchedAt: number;
  source: WeatherSource;
  current: CurrentWeather;
  /** 14 past days, today, and the following 6 days. */
  days: DayWeather[];
  todayIndex: number;
}

/** An hour with at least this much rain (mm) counts as rainy. */
export const RAINY_HOUR_MM = 0.1;
/** Relative humidity above this (%) counts as a wet-leaf hour. */
export const WET_HOUR_RH = 90;
export const CACHE_MS = 60 * 60 * 1000;
const PAST_DAYS = 14;
const FORECAST_DAYS = 7;

export interface FieldPoint {
  id: string;
  lat: number;
  lon: number;
}

export function forecastUrl(f: FieldPoint): string {
  const q = [
    `latitude=${f.lat}`,
    `longitude=${f.lon}`,
    `past_days=${PAST_DAYS}`,
    `forecast_days=${FORECAST_DAYS}`,
    'timezone=auto',
    // wind_direction_10m is added to the requested list: the location risk rule needs it.
    'hourly=temperature_2m,relative_humidity_2m,precipitation,wind_gusts_10m,dew_point_2m,wind_direction_10m',
    'daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max',
    'current=temperature_2m,relative_humidity_2m,precipitation,weather_code',
  ];
  return `https://api.open-meteo.com/v1/forecast?${q.join('&')}`;
}

/** WMO weather code to a short label and icon. */
export function describeWeather(code: number): { label: string; icon: WeatherIcon } {
  if (code >= 95) return { label: 'Storm', icon: 'storm' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'rain' };
  if (code === 85 || code === 86) return { label: 'Snow', icon: 'rain' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Rain', icon: 'rain' };
  if (code === 0 || code === 1) return { label: 'Sunny', icon: 'sunny' };
  return { label: 'Cloudy', icon: 'cloudy' };
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Builds one day from its 24 hourly points and the daily summary values. */
function buildDay(date: string, hours: HourlyPoint[], daily: { tMax?: number; tMin?: number; rain?: number; gust?: number }, forecast: boolean): DayWeather {
  const temps = hours.map((h) => h.temp);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    date,
    tMean: temps.length ? sum(temps) / temps.length : num(daily.tMax),
    tMin: daily.tMin ?? (temps.length ? Math.min(...temps) : 0),
    tMax: daily.tMax ?? (temps.length ? Math.max(...temps) : 0),
    rain: daily.rain ?? sum(hours.map((h) => h.precip)),
    rainyHours: hours.filter((h) => h.precip >= RAINY_HOUR_MM).length,
    wetHours: hours.filter((h) => h.rh > WET_HOUR_RH).length,
    maxGust: daily.gust ?? (hours.length ? Math.max(...hours.map((h) => h.gust)) : 0),
    rhMean: hours.length ? sum(hours.map((h) => h.rh)) / hours.length : 0,
    forecast,
    hours,
  };
}

/** Parses an Open-Meteo response. Throws if the shape is not what we expect. */
export function parseOpenMeteo(json: any, fieldId: string, now: number = Date.now()): FieldWeather {
  const h = json?.hourly;
  const d = json?.daily;
  if (!h?.time || !d?.time || !json?.current) throw new Error('Unexpected weather response');

  const offsetMs = num(json.utc_offset_seconds) * 1000;
  const byDate = new Map<string, HourlyPoint[]>();
  (h.time as string[]).forEach((time, i) => {
    const point: HourlyPoint = {
      time,
      ts: Date.parse(`${time}:00Z`) - offsetMs,
      temp: num(h.temperature_2m?.[i]),
      rh: num(h.relative_humidity_2m?.[i]),
      precip: num(h.precipitation?.[i]),
      gust: num(h.wind_gusts_10m?.[i]),
      dew: num(h.dew_point_2m?.[i]),
      windDir: typeof h.wind_direction_10m?.[i] === 'number' ? h.wind_direction_10m[i] : null,
    };
    const key = time.slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), point]);
  });

  const todayKey = String(json.current.time ?? '').slice(0, 10);
  const days: DayWeather[] = (d.time as string[]).map((date, i) =>
    buildDay(
      date,
      byDate.get(date) ?? [],
      { tMax: d.temperature_2m_max?.[i] ?? undefined, tMin: d.temperature_2m_min?.[i] ?? undefined, rain: d.precipitation_sum?.[i] ?? undefined, gust: d.wind_gusts_10m_max?.[i] ?? undefined },
      date > todayKey,
    ),
  );
  const found = days.findIndex((x) => x.date === todayKey);
  const code = num(json.current.weather_code);

  return {
    fieldId,
    fetchedAt: now,
    source: 'live',
    current: { temp: num(json.current.temperature_2m), rh: num(json.current.relative_humidity_2m), precip: num(json.current.precipitation), code, ...describeWeather(code) },
    days,
    todayIndex: found >= 0 ? found : Math.min(PAST_DAYS, days.length - 1),
  };
}

/**
 * Rain (mm) in the `hours` after `from`, from the hourly data.
 * Returns null when the weather data does not cover the whole period (e.g. older than 14 days).
 */
export function rainWithinHours(w: FieldWeather, from: number | Date | string, hours: number): number | null {
  const start = typeof from === 'number' ? from : new Date(from).getTime();
  return rainInWindow(w.days, start, hours);
}

/** Same as rainWithinHours, for a plain list of days. */
export function rainInWindow(days: DayWeather[], start: number, hours: number): number | null {
  const end = start + hours * 3_600_000;
  const points = days.flatMap((day) => day.hours);
  if (points.length === 0) return null;
  const first = points[0].ts;
  const last = points[points.length - 1].ts + 3_600_000;
  if (start < first || end > last) return null;
  return points.filter((p) => p.ts + 3_600_000 > start && p.ts < end).reduce((t, p) => t + p.precip, 0);
}

// ---------- Demo data ----------

/** Demo rain events, in days from today: [day offset, start hour, hours, mm per hour]. A wet autumn week. */
const DEMO_RAIN: [number, number, number, number][] = [
  [-12, 6, 3, 0.8],
  [-9, 13, 3, 2],
  [-4, 16, 4, 1.5],
  [-3, 2, 5, 0.7],
  [-2, 9, 2, 0.5],
  [1, 5, 6, 1.3],
  [2, 14, 3, 1.6],
];

const pad = (n: number) => String(n).padStart(2, '0');
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A believable offline forecast for the current season. Marked source "demo". */
export function demoWeather(f: FieldPoint, now: number = Date.now()): FieldWeather {
  const today = new Date(now);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days: DayWeather[] = [];
  for (let off = -PAST_DAYS; off < FORECAST_DAYS; off++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + off);
    const doy = Math.floor((day.getTime() - new Date(day.getFullYear(), 0, 0).getTime()) / 86_400_000);
    // Aegean climate: mean about 18.5 °C, swing 9.5 °C, warmest around day 200.
    const seasonal = 18.5 + 9.5 * Math.cos(((doy - 200) / 365) * 2 * Math.PI);
    const jitter = Math.sin(doy * 1.7 + f.lat * 10) * 2;
    const hours: HourlyPoint[] = [];
    for (let hr = 0; hr < 24; hr++) {
      const ts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hr).getTime();
      const temp = seasonal + jitter + 5 * Math.sin(((hr - 9) / 24) * 2 * Math.PI);
      const rain = DEMO_RAIN.filter(([o, start, len]) => o === off && hr >= start && hr < start + len).reduce((t, e) => t + e[3], 0);
      const rh = Math.min(98, Math.max(35, 75 - 20 * Math.sin(((hr - 9) / 24) * 2 * Math.PI) + (rain > 0 ? 15 : 0)));
      hours.push({
        time: `${localKey(day)}T${pad(hr)}:00`,
        ts,
        temp,
        rh,
        precip: rain,
        gust: 14 + 8 * Math.abs(Math.sin(doy + hr / 5)),
        dew: temp - (100 - rh) / 5,
        // The demo week has a north wind, so the Hill ash warning shows up offline too.
        windDir: off >= 0 && off <= 2 ? 350 : (200 + 40 * Math.sin(doy / 3)) % 360,
      });
    }
    days.push(buildDay(localKey(day), hours, {}, off > 0));
  }
  const nowHour = days[PAST_DAYS].hours[Math.min(23, today.getHours())];
  const rainingNow = nowHour.precip > 0;
  const code = rainingNow ? 61 : 3;
  return {
    fieldId: f.id,
    fetchedAt: now,
    source: 'demo',
    current: { temp: nowHour.temp, rh: nowHour.rh, precip: nowHour.precip, code, ...describeWeather(code) },
    days,
    todayIndex: PAST_DAYS,
  };
}

// ---------- Cache and loading ----------

export interface WeatherStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface WeatherDeps {
  fetchImpl?: typeof fetch;
  storage?: WeatherStorage;
  now?: number;
  /** In-memory cache shared between calls. */
  memory?: Map<string, FieldWeather>;
}

const cacheKey = (id: string) => `agropulse.weather.${id}`;

async function readStored(storage: WeatherStorage | undefined, id: string): Promise<FieldWeather | null> {
  if (!storage) return null;
  try {
    const raw = await storage.getItem(cacheKey(id));
    return raw ? (JSON.parse(raw) as FieldWeather) : null;
  } catch {
    return null;
  }
}

/**
 * Weather for one field. A cache younger than 1 hour is used as is ("cached"). Otherwise the
 * forecast is fetched ("live"). If that fails, the last cache is used ("cached"), then demo data ("demo").
 */
export async function getFieldWeather(f: FieldPoint, deps: WeatherDeps = {}, opts: { force?: boolean } = {}): Promise<FieldWeather> {
  const now = deps.now ?? Date.now();
  const memory = deps.memory;
  const cached = memory?.get(f.id) ?? (await readStored(deps.storage, f.id));
  if (cached && memory && !memory.has(f.id)) memory.set(f.id, cached);

  if (cached && !opts.force && now - cached.fetchedAt < CACHE_MS) return { ...cached, source: 'cached' };

  try {
    const doFetch = deps.fetchImpl ?? fetch;
    const res = await doFetch(forecastUrl(f));
    if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
    const fresh = parseOpenMeteo(await res.json(), f.id, now);
    memory?.set(f.id, fresh);
    try {
      await deps.storage?.setItem(cacheKey(f.id), JSON.stringify(fresh));
    } catch {
      // Storage is optional.
    }
    return fresh;
  } catch {
    if (cached) return { ...cached, source: 'cached' };
    return demoWeather(f, now);
  }
}
