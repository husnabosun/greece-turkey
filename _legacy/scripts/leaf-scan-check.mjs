/**
 * Leaf scan through the real app in a browser: three photos go through the dev API and the Hugging Face Space,
 * then three situations are simulated (model not reachable, slow answer, low confidence).
 *
 * Needs two servers:   npm run api                                                          (http://localhost:3001)
 *                      EXPO_PUBLIC_API_URL=http://localhost:3001 npx expo start --web --port 8099
 * Run:   node scripts/leaf-scan-check.mjs http://localhost:8099 healthy.jpg peacock.jpg mite.jpg
 */
import path from 'node:path';
import { chromium } from 'playwright';

const [base = 'http://localhost:8099', ...photos] = process.argv.slice(2);
if (photos.length !== 3) {
  console.log('Usage: node scripts/leaf-scan-check.mjs <app url> <healthy photo> <peacock spot photo> <mite photo>');
  process.exit(2);
}
const OUT = path.resolve(import.meta.dirname, '..', 'screens', 'scan');
let failed = 0;
const check = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) failed++;
};

const browser = await chromium.launch();

/** Opens the camera screen on leaf mode, picks `photo`, and waits for the result screen. */
async function scan(photo, { route, name } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (route) await page.route('**/api/diagnose-leaf', route);
  await page.goto(`${base}/farmer/scan/camera?mode=leaf&fieldId=north`, { waitUntil: 'networkidle', timeout: 120000 });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a photo' }).click();
  (await chooser).setFiles(photo);
  const started = Date.now();
  return { page, ctx, errors, started, name };
}

async function result({ page, started }) {
  await page.waitForURL('**/scan/result/**', { timeout: 90000 });
  await page.getByText('Scan result').first().waitFor();
  await page.waitForTimeout(300);
  return { text: await page.locator('body').innerText(), seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

// 1. Three real photos through the real model.
const NAMES = ['healthy leaf', 'peacock spot leaf', 'olive bud mite leaf'];
const EXPECT = [/Healthy leaf/, /Peacock spot/, /Olive bud mite/];
for (let i = 0; i < 3; i++) {
  const s = await scan(photos[i]);
  const { text, seconds } = await result(s);
  const confidence = text.match(/Confidence (\d+) %/)?.[1];
  const model = text.match(/Model: AgroPulse leaf (\S+)/)?.[1];
  console.log(`INFO  ${NAMES[i]}: ${seconds} s, confidence ${confidence} %, model ${model}`);
  check(EXPECT[i].test(text) && /Our model/.test(text) && !/Demo result/.test(text), `${NAMES[i]}: shows the model result, not a demo`);
  check(confidence !== undefined && model !== undefined, `${NAMES[i]}: shows the confidence and the model line`);
  await s.page.screenshot({ path: path.join(OUT, `leaf-result-${i + 1}.png`) });
  check(s.errors.length === 0, `${NAMES[i]}: no page errors`);
  await s.ctx.close();
}

// 2. The model cannot be reached: the server is not answering.
{
  const s = await scan(photos[0], { route: (r) => r.abort() });
  const { text } = await result(s);
  check(/Demo result/.test(text) && /not a real diagnosis/.test(text), 'server not reachable: the result is labelled "Demo result"');
  await s.page.screenshot({ path: path.join(OUT, 'leaf-result-demo.png') });
  await s.ctx.close();
}

// 3. The server answers with the demo result (model down, timeout, strange answer).
{
  const demo = { ok: true, source: 'demo', label: 'Olive Peacock Spot', confidence: 0.92, top3: [{ label: 'Olive Peacock Spot', confidence: 0.92 }], modelVersion: 'demo' };
  const s = await scan(photos[1], { route: (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(demo) }) });
  const { text } = await result(s);
  check(/Demo result/.test(text) && !/Model: AgroPulse leaf/.test(text) && !/Confidence \d+ %/.test(text), 'demo answer from the server: "Demo result", no model line, no confidence');
  await s.ctx.close();
}

// 4. A sleeping model: after 5 s the screen says it is waking up the model.
{
  const slow = { ok: true, source: 'model', label: 'Healthy', confidence: 0.91, top3: [{ label: 'Healthy', confidence: 0.91 }], modelVersion: 'v2' };
  const s = await scan(photos[0], {
    route: async (r) => {
      await new Promise((ok) => setTimeout(ok, 7000));
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(slow) });
    },
  });
  await s.page.waitForURL('**/scan/analysing**');
  await s.page.waitForTimeout(2500);
  check(!(await s.page.locator('body').innerText()).includes('Waking up'), 'before 5 s: no "Waking up" message yet');
  await s.page.getByText('Waking up the AI model…').waitFor({ timeout: 6000 });
  check(true, 'after 5 s: "Waking up the AI model…" is shown');
  await s.page.screenshot({ path: path.join(OUT, 'leaf-waking.png') });
  const { text, seconds } = await result(s);
  check(/Healthy leaf/.test(text) && Number(seconds) >= 6.5, `the slow answer (${seconds} s) is still used`);
  await s.ctx.close();
}

// 5. Low confidence: below 60 % the screen asks for a new photo.
{
  const low = { ok: true, source: 'model', label: 'Olive Peacock Spot', confidence: 0.52, top3: [{ label: 'Olive Peacock Spot', confidence: 0.52 }, { label: 'Healthy', confidence: 0.41 }, { label: 'Aculus Olearius', confidence: 0.07 }], modelVersion: 'v2' };
  const s = await scan(photos[1], { route: (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(low) }) });
  const { text } = await result(s);
  check(text.includes('Not sure – retake the photo in good light, or ask an agronomist'), 'below 60 %: "Not sure – retake the photo in good light, or ask an agronomist"');
  check(/Confidence 52 %/.test(text) && /Model: AgroPulse leaf v2/.test(text), 'below 60 %: the confidence and the model line are still shown');
  await s.page.screenshot({ path: path.join(OUT, 'leaf-result-unsure.png') });
  await s.ctx.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
