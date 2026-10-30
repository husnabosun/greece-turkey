/**
 * Backtest of the risk engine on 5 years of real weather (2021-2025), for 4 olive regions.
 *
 * Run from the project root:   npx tsx research/scripts/backtest.ts
 *
 * - Downloads hourly weather from the Open-Meteo archive (free, no key), one request per location and year.
 *   Raw answers are cached in research/data/raw/, so downloads happen only once.
 * - For every day, calls the real engine (src/lib/risk) with NO field signals, and with only a sliding window
 *   of weather (45 days before, the day, 6 days after), todayIndex on that day, source "live" and now = noon of
 *   that day. So the engine behaves exactly as it would on that date in the app.
 * - Writes research/data/backtest.csv: location, country, date, threat, score, level, top_driver.
 *
 * The app code is not changed: the archive answer is turned into the forecast shape and read by the app's own
 * parseOpenMeteo().
 */
import fs from 'node:fs';
import path from 'node:path';
import { assessThreats } from './engine';
import { parseOpenMeteo, type DayWeather } from '../../src/lib/weather';

const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const OUT_CSV = path.join(ROOT, 'data', 'backtest.csv');

const LOCATIONS = [
  { name: 'Ayvalık', slug: 'ayvalik', country: 'TR', lat: 39.32, lon: 26.69 },
  { name: 'Edremit', slug: 'edremit', country: 'TR', lat: 39.59, lon: 27.02 },
  { name: 'Kalamata', slug: 'kalamata', country: 'GR', lat: 37.04, lon: 22.11 },
  { name: 'Chania', slug: 'chania', country: 'GR', lat: 35.51, lon: 24.02 },
];
const YEARS = [2021, 2022, 2023, 2024, 2025];
const DAYS_BEFORE = 45;
const DAYS_AFTER = 6;

const HOURLY = 'temperature_2m,relative_humidity_2m,precipitation,wind_gusts_10m,dew_point_2m,wind_direction_10m';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One year of hourly weather, from the cache or from the archive API. */
async function loadYear(loc: (typeof LOCATIONS)[number], year: number): Promise<any> {
  const file = path.join(RAW_DIR, `${loc.slug}_${year}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&start_date=${year}-01-01&end_date=${year}-12-31&hourly=${HOURLY}&timezone=auto`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      fs.mkdirSync(RAW_DIR, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(json));
      console.log(`  downloaded ${loc.slug} ${year}`);
      await sleep(800);
      return json;
    }
    const wait = 5000 * attempt;
    console.log(`  ${loc.slug} ${year}: HTTP ${res.status}, retrying in ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`Could not download ${loc.slug} ${year}`);
}

/** Archive answer -> the forecast shape that parseOpenMeteo() reads. Daily values come from the hourly ones. */
function toForecastShape(raw: any) {
  const h = raw.hourly;
  const dates: string[] = [];
  const tmax: number[] = [];
  const tmin: number[] = [];
  const rain: number[] = [];
  const gust: number[] = [];
  let cur = '';
  (h.time as string[]).forEach((t, i) => {
    const d = t.slice(0, 10);
    if (d !== cur) {
      cur = d;
      dates.push(d);
      tmax.push(-Infinity);
      tmin.push(Infinity);
      rain.push(0);
      gust.push(0);
    }
    const k = dates.length - 1;
    tmax[k] = Math.max(tmax[k], h.temperature_2m[i] ?? -Infinity);
    tmin[k] = Math.min(tmin[k], h.temperature_2m[i] ?? Infinity);
    rain[k] += h.precipitation[i] ?? 0;
    gust[k] = Math.max(gust[k], h.wind_gusts_10m[i] ?? 0);
  });
  const last = (h.time as string[])[h.time.length - 1];
  return {
    utc_offset_seconds: raw.utc_offset_seconds,
    current: { time: last, temperature_2m: 0, relative_humidity_2m: 0, precipitation: 0, weather_code: 0 },
    hourly: h,
    daily: { time: dates, temperature_2m_max: tmax, temperature_2m_min: tmin, precipitation_sum: rain, wind_gusts_10m_max: gust },
  };
}

const csv = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const started = Date.now();
  const rows: string[] = ['location,country,date,threat,score,level,top_driver'];
  let missing = 0;

  for (const loc of LOCATIONS) {
    console.log(`${loc.name} (${loc.country})`);
    let days: DayWeather[] = [];
    for (const year of YEARS) {
      const raw = await loadYear(loc, year);
      missing += (raw.hourly.temperature_2m as (number | null)[]).filter((v) => v === null).length;
      days = days.concat(parseOpenMeteo(toForecastShape(raw), loc.slug).days);
    }

    for (let i = 0; i < days.length; i++) {
      const from = Math.max(0, i - DAYS_BEFORE);
      const window = days.slice(from, Math.min(days.length, i + DAYS_AFTER + 1));
      // The hour at noon, local time, as the app's "now".
      const now = days[i].hours[12]?.ts ?? Date.parse(`${days[i].date}T12:00:00Z`);
      for (const a of assessThreats(window, i - from, days[i].date, now)) {
        rows.push([loc.name, loc.country, a.day, a.threat, a.score, a.level, a.drivers[0] ?? ''].map(csv).join(','));
      }
    }
    console.log(`  ${days.length} days assessed`);
  }

  fs.writeFileSync(OUT_CSV, rows.join('\n') + '\n');
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nWrote ${rows.length - 1} rows to ${path.relative(process.cwd(), OUT_CSV)}`);
  if (missing) console.log(`Note: ${missing} hourly temperature values were missing in the downloads.`);
  console.log(`Run took ${seconds} s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
