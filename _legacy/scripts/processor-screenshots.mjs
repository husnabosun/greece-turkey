/**
 * Screenshots of the landing page and the processor pages at 1440 px and 390 px, into screens/processor/.
 * Also clicks through the connected demo (processor offer -> farmer accepts -> delivery) and prints the result.
 *
 * Run from the project root, after `npx expo export -p web`:   node scripts/processor-screenshots.mjs
 * It serves dist/ itself, with the same single-page fallback as vercel.json.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'screens', 'processor');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const PAGES = [
  ['landing', '/'],
  ['overview', '/processor'],
  ['find-olives', '/processor/lots'],
  ['lot-detail', '/processor/lots/river'],
  ['my-requests', '/processor/requests'],
  ['deliveries', '/processor/deliveries'],
];
const FARMER = [['farmer-market-offers', '/farmer/market/offers']];
const SIZES = [
  ['1440', { width: 1440, height: 900 }],
  ['390', { width: 390, height: 844 }],
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function open(page, url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

/** The pages scroll inside a ScrollView, so make the window as tall as the content before the shot. */
async function shoot(page, size, file) {
  const height = await page.evaluate(() => {
    let max = 0;
    for (const el of document.querySelectorAll('*')) max = Math.max(max, el.scrollHeight);
    return max;
  });
  await page.setViewportSize({ width: size.width, height: Math.min(Math.max(height, size.height), 3200) });
  await page.waitForTimeout(250);
  await page.screenshot({ path: file });
  await page.setViewportSize(size);
}

for (const [label, size] of SIZES) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${label}] page error:`, e.message));
  for (const [name, url] of [...PAGES, ...FARMER]) {
    await open(page, url);
    const file = path.join(name.startsWith('farmer') ? path.join(OUT, 'compare') : OUT, `${name}-${label}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await shoot(page, size, file);
    console.log('shot', path.relative(ROOT, file));
  }
  await open(page, '/processor/deliveries');
  await page.getByRole('tab', { name: 'Completed' }).click();
  await page.waitForTimeout(300);
  const completedFile = path.join(OUT, `deliveries-completed-${label}.png`);
  await shoot(page, size, completedFile);
  console.log('shot', path.relative(ROOT, completedFile));
  await ctx.close();
}

// Dialog screenshots (1440 only).
{
  const ctx = await browser.newContext({ viewport: SIZES[0][1] });
  const page = await ctx.newPage();
  await open(page, '/processor/lots/river');
  await page.getByRole('button', { name: 'Make offer' }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'dialog-make-offer-1440.png') });
  await ctx.close();
}

// Connected demo: processor offer -> farmer Market > Offers -> accept -> processor Deliveries. No reload in between.
let failed = 0;
const check = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) failed++;
};
{
  const ctx = await browser.newContext({ viewport: SIZES[0][1] });
  const page = await ctx.newPage();
  const body = () => page.locator('body').innerText();

  await open(page, '/');
  await page.getByRole('link', { name: /Processor panel/ }).click();
  await page.waitForURL('**/processor');
  check((await body()).includes('Demo Olive Oil Co.'), 'landing card opens the processor panel');

  await page.getByRole('link', { name: 'Find olives' }).first().click();
  await page.getByText(/Ayvalık olives · 2\.5 t/).first().waitFor();
  check(!(await body()).includes('Mehmet'), 'farmer name is hidden in the lot list');
  await ctx.close();
}

{
  // Same flow without any reload: navigate only with in-app links.
  const ctx = await browser.newContext({ viewport: SIZES[0][1] });
  const page = await ctx.newPage();
  const body = () => page.locator('body').innerText();
  await open(page, '/processor/lots/river');
  await page.getByRole('button', { name: 'Make offer' }).first().click();
  await page.getByRole('button', { name: 'Send offer' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('link', { name: 'Switch view' }).first().click();
  await page.getByRole('link', { name: /Farmer app/ }).click();
  await page.waitForURL('**/farmer');
  await page.getByRole('tab', { name: 'Market' }).click();
  await page.getByRole('tab', { name: /^Offers/ }).click();
  await page.waitForTimeout(500);
  const text = await body();
  check(text.includes('Demo Olive Oil Co.'), 'processor offer appears in farmer Market > Offers');
  check(text.includes('2.5 t · delivery'), 'the offer shows tonnes and delivery date');

  const card = page.locator('text=Demo Olive Oil Co. >> visible=true').first();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'compare', 'farmer-offer-from-processor-1440.png') });
  await page.getByRole('button', { name: 'Accept' }).first().click();
  await page.waitForTimeout(400);
  // Accept sits on the highest offer first; accept until the Demo offer is gone.
  for (let i = 0; i < 4 && (await body()).includes('2.5 t · delivery'); i++) await page.getByRole('button', { name: 'Accept' }).first().click();

  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByLabel('Settings').click();
  await page.getByText('Switch view').last().click();
  await page.waitForURL(BASE + '/');
  await page.getByRole('link', { name: /Processor panel/ }).click();
  await page.waitForURL('**/processor');
  await page.getByRole('link', { name: 'Deliveries' }).first().click();
  await page.waitForTimeout(400);
  const deliveries = await body();
  check(deliveries.includes('Mehmet'), 'accepted offer appears in processor Deliveries with the farmer name');
  await ctx.close();
}

{
  // Request created by the processor -> farmer Market > Requests. Weighbridge and traceability report.
  const ctx = await browser.newContext({ viewport: SIZES[0][1] });
  const page = await ctx.newPage();
  const body = () => page.locator('body').innerText();
  await open(page, '/processor/requests');
  await page.getByRole('button', { name: 'New request' }).click();
  await page.getByRole('button', { name: 'Create request' }).click();
  await page.waitForTimeout(300);
  check((await body()).includes('Visible to farmers'), 'new request is listed with "Visible to farmers"');
  await page.screenshot({ path: path.join(OUT, 'dialog-new-request-after-1440.png') });

  await page.getByRole('link', { name: 'Deliveries' }).first().click();
  await page.getByRole('button', { name: 'Record weighbridge' }).first().click();
  await page.screenshot({ path: path.join(OUT, 'dialog-weighbridge-1440.png') });
  await page.getByLabel('Actual weight').fill('5100');
  await page.getByRole('button', { name: 'Save weight' }).click();
  await page.waitForTimeout(300);
  check((await body()).includes('Weighed 5,100 kg'), 'weighbridge result is saved on the delivery');
  await page.getByRole('button', { name: 'Download traceability report' }).first().click();
  await page.waitForTimeout(200);
  check((await body()).includes('Traceability report'), 'traceability report shows a toast');

  await page.getByRole('link', { name: 'Switch view' }).first().click();
  await page.getByRole('link', { name: /Farmer app/ }).click();
  await page.waitForURL('**/farmer');
  await page.getByRole('tab', { name: 'Market' }).click();
  await page.getByRole('tab', { name: /^Requests/ }).click();
  await page.waitForTimeout(400);
  const requests = await body();
  check(requests.includes('Demo Olive Oil Co.') && requests.includes('Score 75+'), 'processor request appears in farmer Market > Requests');
  await page.screenshot({ path: path.join(OUT, 'compare', 'farmer-requests-with-processor-request-1440.png') });
  await ctx.close();
}

{
  // Purchase history: season totals, farmers bought from, prefilled request, Mark paid.
  const ctx = await browser.newContext({ viewport: SIZES[0][1] });
  const page = await ctx.newPage();
  const body = () => page.locator('body').innerText();
  await open(page, '/processor/deliveries');
  check((await body()).includes('Active') && (await body()).includes('Completed'), 'Deliveries has the Active and Completed tabs');
  await page.getByRole('tab', { name: 'Completed' }).click();
  await page.waitForTimeout(300);
  let text = await body();
  check(text.includes('40.6 t') && text.includes('€37,700') && text.includes('88%'), 'season stats: tonnes, spent and share without banned products');
  check(text.includes('Purchase history') && text.includes('Your farmers') && text.includes('Hasan Çelik'), 'purchase history and "Your farmers" are shown');

  await page.getByRole('button', { name: 'Send request' }).first().click();
  await page.waitForTimeout(300);
  text = await body();
  check(text.includes('Prefilled for the region and variety of Hasan Çelik'), 'Send request opens New request prefilled for that farmer');
  await page.screenshot({ path: path.join(OUT, 'dialog-send-request-1440.png') });
  await page.getByRole('button', { name: 'Create request' }).click();
  await page.waitForTimeout(300);

  // Finish the active deliveries: weighbridge, lab, paid. They move to Completed.
  await page.getByRole('tab', { name: /^Active/ }).click();
  await page.getByRole('button', { name: 'Mark lab checked' }).first().click();
  await page.getByRole('button', { name: 'Mark paid' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('tab', { name: 'Completed' }).click();
  await page.waitForTimeout(300);
  text = await body();
  check(text.includes('Zeynep Aksoy') && text.includes('Purchase history'), 'a delivery marked as paid appears under Completed');
  check(text.includes('3.48 t'), 'the paid delivery shows the weighed tonnes');
  await ctx.close();
}

{
  // Supply outlook, trust badges, lab test advice, filter, explicit variety and district.
  const ctx = await browser.newContext({ viewport: SIZES[0][1] });
  const page = await ctx.newPage();
  const body = () => page.locator('body').innerText();
  await open(page, '/processor');
  let text = await body();
  check(text.includes('Supply outlook') && text.includes('Pest risk this week'), 'Overview shows the supply outlook');
  for (const region of ['Aydın', 'Balıkesir', 'İzmir', 'Crete', 'Messinia']) check(text.includes(region), `supply outlook has a row for ${region}`);
  check(/risk (high|medium) this week: (check lots before buying|ask for spray records)|Low risk this week/.test(text), 'supply outlook has a one-line risk text');
  check(text.includes('Variety: Ayvalık') && text.includes('Edremit, Balıkesir'), 'Overview offers show the variety explicitly and "District, Province"');
  check(text.includes('Reliable delivery') || text.includes('Complete records'), 'Overview offers show trust badges');

  await open(page, '/processor/lots');
  text = await body();
  check(text.includes('Ayvalık olives') && text.includes('Ayvalık, Balıkesir'), 'Find olives tells the variety "Ayvalık olives" from the district "Ayvalık, Balıkesir"');
  check(text.includes('Lab test suggested') || text.includes('Records complete'), 'lots show "Lab test suggested" or "Records complete"');
  await page.getByRole('button', { name: /Lab test suggested/ }).first().click();
  await page.waitForTimeout(300);
  text = await body();
  check(text.includes('Why a lab test?'), 'tapping the pill explains why');
  await page.screenshot({ path: path.join(OUT, 'find-olives-lab-reason-1440.png') });
  await page.getByRole('button', { name: /Lab test suggested/ }).first().click();

  const before = (text.match(/Quality score/g) ?? []).length;
  await page.getByRole('checkbox', { name: 'Lab test suggested' }).click();
  await page.waitForTimeout(300);
  text = await body();
  check(!text.includes('Records complete') && text.includes('Lab test suggested'), 'the "Lab test suggested" filter keeps only lots with a suggestion');
  check((text.match(/Quality score/g) ?? []).length <= before, 'the filter does not add lots');

  await open(page, '/processor/lots/lot-ay2');
  text = await body();
  check(text.includes('FARMER TRUST') && text.includes('Location') && text.includes('Ayvalık, Balıkesir'), 'Lot detail shows trust badges and the location');
  check(text.includes('Records complete') || text.includes('Why a lab test?'), 'Lot detail explains the lab test advice');
  await ctx.close();
}

{
  // Every farmer route still loads after the move to /farmer.
  const ROUTES = ['/farmer', '/farmer/field', '/farmer/scan', '/farmer/logbook', '/farmer/market', '/farmer/market/requests', '/farmer/market/offers', '/farmer/market/sales', '/farmer/market/new', '/farmer/quality', '/farmer/alerts', '/farmer/tasks', '/farmer/onboarding', '/farmer/onboarding/crop', '/farmer/alert/peacock-spot?fieldId=north', '/processor', '/processor/lots', '/processor/lots/hill', '/processor/requests', '/processor/deliveries'];
  const ctx = await browser.newContext({ viewport: SIZES[0][1] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const url of ROUTES) {
    await open(page, url);
    const text = await page.locator('body').innerText();
    check(!/Unmatched Route|This screen doesn.t exist/i.test(text) && text.trim().length > 20, `deep link ${url} loads`);
  }
  check(errors.length === 0, `no page errors while loading ${ROUTES.length} routes${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
}

await browser.close();
server.close();
if (failed) {
  console.log(`${failed} check(s) failed`);
  process.exit(1);
}
