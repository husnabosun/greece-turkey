/** Helpers to build weather days and inputs for the risk tests. Not used by the app. */
import type { DayWeather, HourlyPoint } from '../weather';
import type { AssessInput, FieldSignals } from './types';

export interface DayParts {
  tMean: number;
  tMin: number;
  tMax: number;
  rain: number;
  rainyHours: number;
  wetHours: number;
  maxGust: number;
  rhMean: number;
  /** Hours of the day with the wind blowing from `windDir` at `maxGust` km/h. */
  windHours: number;
  windDir: number;
}

export const DRY_MILD: DayParts = { tMean: 15, tMin: 11, tMax: 19, rain: 0, rainyHours: 0, wetHours: 3, maxGust: 18, rhMean: 65, windHours: 0, windDir: 200 };
const HOUR = 3_600_000;

function makeDay(date: string, parts: DayParts, forecast: boolean): DayWeather {
  const start = Date.parse(`${date}T00:00:00Z`);
  const hours: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const rainy = h >= 14 && h < 14 + parts.rainyHours;
    const windy = h < parts.windHours;
    hours.push({
      time: `${date}T${String(h).padStart(2, '0')}:00`,
      ts: start + h * HOUR,
      temp: parts.tMean,
      rh: h < parts.wetHours ? 95 : parts.rhMean,
      precip: rainy ? parts.rain / parts.rainyHours : 0,
      gust: windy ? parts.maxGust : Math.min(parts.maxGust, 10),
      dew: parts.tMean - 3,
      windDir: parts.windDir,
    });
  }
  return {
    date,
    tMean: parts.tMean,
    tMin: parts.tMin,
    tMax: parts.tMax,
    rain: parts.rain,
    rainyHours: parts.rainyHours,
    wetHours: parts.wetHours,
    maxGust: parts.maxGust,
    rhMean: parts.rhMean,
    forecast,
    hours,
  };
}

/** `count` days from `start` ("YYYY-MM-DD"). Today is the day at index `todayIndex`. */
export function series(start: string, count: number, base: Partial<DayParts> = {}, overrides: Record<number, Partial<DayParts>> = {}, todayIndex = 14): DayWeather[] {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(t0 + i * 24 * HOUR).toISOString().slice(0, 10);
    return makeDay(date, { ...DRY_MILD, ...base, ...(overrides[i] ?? {}) }, i > todayIndex);
  });
}

export const NO_SIGNALS: FieldSignals = { scans: [], sprays: [], locationRisks: [], locationMitigated: false };

/** Input for the day at `dayIndex` (default: today, index 14). `now` is noon on today. */
export function inputFor(weather: DayWeather[], dayIndex = 14, signals: Partial<FieldSignals> = {}, source: AssessInput['source'] = 'live', todayIndex = 14): AssessInput {
  return {
    day: weather[dayIndex].date,
    weather,
    todayIndex,
    source,
    now: Date.parse(`${weather[todayIndex].date}T12:00:00Z`),
    signals: { ...NO_SIGNALS, ...signals },
  };
}

/** 14 past days, today and 6 coming days around `today`. `rel` overrides days by offset from today (-3 = three days ago). */
export function around(today: string, base: Partial<DayParts> = {}, rel: Record<number, Partial<DayParts>> = {}): DayWeather[] {
  const start = new Date(Date.parse(`${today}T00:00:00Z`) - 14 * 24 * HOUR).toISOString().slice(0, 10);
  const overrides = Object.fromEntries(Object.entries(rel).map(([k, v]) => [14 + Number(k), v]));
  return series(start, 21, base, overrides);
}
