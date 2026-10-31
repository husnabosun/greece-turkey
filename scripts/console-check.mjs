/**
 * Opens the landing page and every processor page in a browser and prints all console errors and warnings.
 *
 * Run from the project root, with the dev server running:   node scripts/console-check.mjs [http://localhost:8081]
 * Use the dev server (npx expo start --web): React only prints key and DOM-nesting warnings in development.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:8081';
const PAGES = ['/', '/processor', '/processor/lots', '/processor/lots/river', '/processor/lots/lot-ay4', '/processor/requests', '/processor/deliveries'];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
let current = '';
const seen = new Map();
const add = (kind, text) => {
  const key = `${kind}|${text}`;
  if (!seen.has(key)) seen.set(key, { kind, text, pages: new Set() });
  seen.get(key).pages.add(current);
};
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') add(m.type(), m.text());
});
page.on('pageerror', (e) => add('pageerror', e.message));

for (const url of PAGES) {
  current = url;
  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(800);
}

// Interactions that open dialogs, switch tabs and filters.
current = 'interactions';
await page.goto(BASE + '/processor/lots/river', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Make offer' }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Cancel' }).click();
await page.goto(BASE + '/processor/requests', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'New request' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Cancel' }).click();
await page.getByRole('link', { name: 'Deliveries' }).first().click();
await page.getByRole('button', { name: 'Record weighbridge' }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Cancel' }).click();
await page.getByRole('tab', { name: 'Completed' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Send request' }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Cancel' }).click();
await page.getByRole('tab', { name: /^Active/ }).click();
await page.waitForTimeout(300);

await browser.close();
if (seen.size === 0) console.log('Console is clean.');
for (const { kind, text, pages } of seen.values()) console.log(`\n[${kind}] on ${[...pages].join(', ')}\n${text.slice(0, 900)}`);
process.exit(seen.size ? 1 : 0);
