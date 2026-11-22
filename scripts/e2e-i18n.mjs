#!/usr/bin/env node
/**
 * Opens every public, farmer and processor page in en / el / tr (390x844 phone viewport) and fails on
 * next-intl errors in the browser console (MISSING_MESSAGE, FORMATTING_ERROR, INVALID_MESSAGE ...).
 * It also warns about raw message keys / {placeholders} in the page text and Greek / Turkish text on English pages.
 *
 * Usage (app already running, e.g. `npm run build && npm start -- -p 3100`):
 *   E2E_BASE_URL=http://localhost:3100 \
 *   E2E_FARMER_EMAIL=... E2E_FARMER_PASSWORD=... \
 *   E2E_PROCESSOR_EMAIL=... E2E_PROCESSOR_PASSWORD=... \
 *   node scripts/e2e-i18n.mjs
 *
 * Without credentials only the public pages (login, register, 404) are checked.
 * Playwright is not a project dependency: install it anywhere and point PLAYWRIGHT_DIR at that folder
 * (the one that contains node_modules/playwright), or run from a folder that can resolve "playwright".
 */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(
  process.env.PLAYWRIGHT_DIR ? path.join(path.resolve(process.env.PLAYWRIGHT_DIR), "noop.js") : import.meta.url,
);
const { chromium } = require("playwright");

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const LOCALES = (process.env.E2E_LOCALES ?? "en,el,tr").split(",");
const ONLY = process.env.E2E_ONLY ? new RegExp(process.env.E2E_ONLY) : null;

const CREDS = {
  farmer: { email: process.env.E2E_FARMER_EMAIL, password: process.env.E2E_FARMER_PASSWORD },
  processor: { email: process.env.E2E_PROCESSOR_EMAIL, password: process.env.E2E_PROCESSOR_PASSWORD },
};

const INTL_ERROR = /MISSING_MESSAGE|FORMATTING_ERROR|INVALID_MESSAGE|INVALID_KEY|ENVIRONMENT_FALLBACK|Could not resolve .* in messages/;
const GREEK = /[Ͱ-Ͽἀ-῿]/;
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;
// "farmerFields.treeN" style leftovers: next-intl returns `${namespace}.${key}` when a message is missing
const RAW_KEY = /\b(?:farmer|processor|auth|errors|common|roles|nav|landing|meta|scoreHistory|riskThreats)[A-Za-z]*\.[a-z][A-Za-z0-9_.]{2,}\b/;
const RAW_PLACEHOLDER = /\{[a-zA-Z_]+\}/;

const PUBLIC_PAGES = ["/login", "/register", "/this-page-does-not-exist"];
const FARMER_PAGES = [
  "/farmer/dashboard",
  "/farmer/fields",
  "/farmer/fields/new",
  "/farmer/quality",
  "/farmer/tasks",
  "/farmer/scan",
  "/farmer/logbook",
  "/farmer/market",
  "/farmer/market/new",
  "/farmer/alerts",
  "/farmer/notifications",
  "/farmer/welcome",
  "/farmer/fields/:fieldId/score",
];
const PROCESSOR_PAGES = [
  "/processor/overview",
  "/processor/lots",
  "/processor/lots/:lotId",
  "/processor/offers",
  "/processor/offers/:offerId",
  "/processor/deliveries",
  "/processor/requests",
];

const problems = [];
const warnings = [];
const visited = [];

function note(list, locale, url, kind, text) {
  list.push({ locale, url: url.replace(BASE, ""), kind, text: String(text).replace(/\s+/g, " ").slice(0, 220) });
}

async function login(context, role, locale) {
  const { email, password } = CREDS[role];
  const page = await context.newPage();
  await page.goto(`${BASE}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(new RegExp(`/${locale}/(farmer|processor)/`), { timeout: 30_000 });
  await page.close();
}

/** Find ids to open detail pages: follow the first link that matches in the list page. */
async function discoverId(page, locale, listPath, hrefPattern) {
  await page.goto(`${BASE}/${locale}${listPath}`, { waitUntil: "networkidle" }).catch(() => {});
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
  const hit = hrefs.map((h) => h.match(hrefPattern)).find(Boolean);
  return hit ? hit[1] : null;
}

async function visit(context, locale, urlPath) {
  const url = `${BASE}/${locale}${urlPath}`;
  const page = await context.newPage();
  page.on("console", (msg) => {
    const text = msg.text();
    if (INTL_ERROR.test(text)) note(problems, locale, url, `console.${msg.type()}`, text);
  });
  page.on("pageerror", (err) => {
    if (INTL_ERROR.test(String(err))) note(problems, locale, url, "pageerror", err);
    else note(warnings, locale, url, "pageerror", err);
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    visited.push(`${locale}${urlPath}`);
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const raw = text.match(RAW_KEY);
    if (raw) note(problems, locale, url, "raw-key-on-screen", raw[0]);
    const ph = text.match(RAW_PLACEHOLDER);
    if (ph) note(problems, locale, url, "raw-placeholder-on-screen", ph[0]);
    if (locale === "en") {
      const lines = text.split("\n").filter((l) => GREEK.test(l) || TURKISH.test(l));
      // the language switcher legitimately shows native names
      const leak = lines.filter((l) => !/^(Ελληνικά|Türkçe|EL|TR|EN)$/i.test(l.trim()));
      if (leak.length) note(warnings, locale, url, "other-language-on-en-page", leak.slice(0, 3).join(" | "));
    }
  } finally {
    await page.close();
  }
}

async function runRole(browser, role, pages, discovers) {
  if (!CREDS[role].email || !CREDS[role].password) {
    console.log(`- ${role}: no E2E_${role.toUpperCase()}_EMAIL / _PASSWORD set, pages skipped`);
    return;
  }
  for (const locale of LOCALES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: locale === "en" ? "en-GB" : locale });
    try {
      await login(context, role, locale);
    } catch (e) {
      note(problems, locale, `${BASE}/${locale}/login`, `login-failed(${role})`, e.message);
      await context.close();
      continue;
    }
    const probe = await context.newPage();
    const ids = {};
    for (const d of discovers) ids[d.name] = await discoverId(probe, locale, d.listPath, d.pattern);
    await probe.close();

    for (const p of pages) {
      let target = p;
      let skip = false;
      for (const [name, id] of Object.entries(ids)) {
        if (target.includes(`:${name}`)) {
          if (!id) skip = true;
          else target = target.replace(`:${name}`, id);
        }
      }
      if (skip) {
        console.log(`  (${locale}) ${p}: no record to open, skipped`);
        continue;
      }
      if (ONLY && !ONLY.test(target)) continue;
      await visit(context, locale, target);
    }
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  for (const locale of LOCALES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: locale === "en" ? "en-GB" : locale });
    for (const p of PUBLIC_PAGES) if (!ONLY || ONLY.test(p)) await visit(context, locale, p);
    await context.close();
  }
  await runRole(browser, "farmer", FARMER_PAGES, [
    { name: "fieldId", listPath: "/farmer/fields", pattern: /\/farmer\/fields\/([0-9a-f-]{36})\/score/ },
  ]);
  await runRole(browser, "processor", PROCESSOR_PAGES, [
    { name: "lotId", listPath: "/processor/lots", pattern: /\/processor\/lots\/([0-9a-f-]{36})/ },
    { name: "offerId", listPath: "/processor/offers", pattern: /\/processor\/offers\/([0-9a-f-]{36})/ },
  ]);
} finally {
  await browser.close();
}

console.log(`\nVisited ${visited.length} page loads.`);
if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  [${w.locale}] ${w.url}  ${w.kind}: ${w.text}`);
}
if (problems.length) {
  console.error(`\nFAILED: ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  [${p.locale}] ${p.url}  ${p.kind}: ${p.text}`);
  process.exit(1);
}
console.log("\nOK: no MISSING_MESSAGE / FORMATTING_ERROR / raw keys / raw placeholders found.");
