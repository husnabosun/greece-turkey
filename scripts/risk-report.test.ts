/**
 * @jest-environment node
 *
 * Dev tool, not part of `npm test`: prints today's risk of every field from live weather.
 * Run with: npm run risk-report
 */
import { fields, initialScans, sprays } from '../src/data/mock';
import { assessField, THREAT_BY_ID, THREATS } from '../src/lib/risk';
import { buildSignals } from '../src/lib/risk/signals';
import { getFieldWeather } from '../src/lib/weather';

/** jest-expo replaces the global fetch, so the report uses Node's https directly. */
const nodeFetch = ((url: string) =>
  new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('https')
      .get(url, (res: any) => {
        let body = '';
        res.on('data', (c: string) => (body += c));
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, json: async () => JSON.parse(body) }));
      })
      .on('error', reject);
  })) as unknown as typeof fetch;

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

it('prints the risk table', async () => {
  const now = Date.now();
  const lines: string[] = [];
  for (const f of fields) {
    const w = await getFieldWeather({ id: f.id, lat: f.lat, lon: f.lon }, { memory: new Map(), fetchImpl: nodeFetch });
    const today = w.days[w.todayIndex];
    const signals = buildSignals(f, initialScans, sprays, false);
    const risk = assessField(w, signals, now);
    lines.push('');
    lines.push(`${f.name}  (weather: ${w.source}, today ${today.date}: mean ${today.tMean.toFixed(1)} °C, rain ${today.rain.toFixed(1)} mm, ${today.rainyHours} rainy h, ${today.wetHours} wet h, gust ${Math.round(today.maxGust)} km/h)`);
    lines.push(`${pad('Threat', 15)}${pad('Score', 7)}${pad('Level', 8)}${pad('Conf.', 8)}Drivers`);
    for (const t of THREATS) {
      const a = risk[t.id][0];
      lines.push(`${pad(THREAT_BY_ID[t.id].name, 15)}${pad(String(a.score), 7)}${pad(a.level, 8)}${pad(a.confidence, 8)}${a.drivers.slice(0, 3).join(' | ')}`);
    }
  }
  console.log(lines.join('\n'));
});
