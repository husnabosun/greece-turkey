/**
 * Shows the three AI features with a real Gemini key: `npm run ai:demo -- label.jpg trap.jpg [fruit.jpg]`.
 * Reads GEMINI_API_KEY from .env. Prints a label read into the spray form (with the EU check),
 * a trap photo counted, and the advisor text in Turkish and Greek.
 */
import { readFileSync } from 'node:fs';
import { fields, initialScans, sprays } from '../src/data/mock';
import { buildAdviceRequest, fruitToDiagnosis, labelToDraft, trapToDiagnosis } from '../src/lib/ai/mappers';
import { advise, diagnoseFruitTrap, readLabel, type AiDeps } from '../src/lib/ai/server';
import { fruitResult, labelResult, trapResult, adviceResult } from '../src/lib/ai/schemas';
import { assessField } from '../src/lib/risk';
import { buildSignals } from '../src/lib/risk/signals';
import { demoWeather } from '../src/lib/weather';

const deps: AiDeps = { env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL } };
const [labelPath, trapPath, fruitPath] = process.argv.slice(2);
const b64 = (p: string) => readFileSync(p).toString('base64');
const show = (title: string, value: unknown) => console.log(`\n=== ${title} ===\n${JSON.stringify(value, null, 2)}`);

async function main() {
  if (!deps.env.GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY is missing. Put it in .env (see .env.example). Every call would return { ok: false }.');
    return;
  }

  if (labelPath) {
    const r = await readLabel({ imageBase64: b64(labelPath) }, deps);
    show('POST /api/read-label', r.body);
    const parsed = labelResult.safeParse(r.body);
    if (parsed.success) show('Add spray form (what the app pre-fills, "Read from label" on each field)', labelToDraft(parsed.data));
  }

  if (trapPath) {
    const r = await diagnoseFruitTrap({ imageBase64: b64(trapPath), mode: 'trap' }, deps);
    show('POST /api/diagnose-fruit-trap (trap)', r.body);
    const parsed = trapResult.safeParse(r.body);
    if (parsed.success) show('Scan result in the app', trapToDiagnosis(parsed.data));
  }

  if (fruitPath) {
    const r = await diagnoseFruitTrap({ imageBase64: b64(fruitPath), mode: 'fruit' }, deps);
    show('POST /api/diagnose-fruit-trap (fruit)', r.body);
    const parsed = fruitResult.safeParse(r.body);
    if (parsed.success) show('Scan result in the app', fruitToDiagnosis(parsed.data));
  }

  // The advisor explains what our own risk engine found for the first field today.
  const now = Date.now();
  const field = fields[0];
  const weather = demoWeather({ id: field.id, lat: field.lat, lon: field.lon }, now);
  const risk = assessField(weather, buildSignals(field, initialScans, sprays), now);
  for (const language of ['tr', 'el'] as const) {
    const req = buildAdviceRequest({ language, field, risk, weather, scans: initialScans, sprays, now });
    if (language === 'tr') show('Engine numbers sent to the advisor', req.risks);
    const r = await advise(req, deps);
    show(`POST /api/advise (${language})`, r.body);
    if (!adviceResult.safeParse(r.body).success) console.log('(no advice: the answer failed a check or the call failed)');
  }
}

void main();
