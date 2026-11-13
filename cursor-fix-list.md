# AgroPulse — make the new Next.js app look and behave exactly like the demo

## Context (read first)
- **Goal:** the frontend must look and behave **exactly like the deployed demo**: https://agropulse-husnabosuns-projects.vercel.app (the Expo/React-Native-web build archived in `_legacy/`). The backend is new: Next.js 15 App Router, Supabase (Postgres + PostGIS + RLS), Gemini and Open-Meteo API routes. **Keep the new backend. Copy the UI from the demo.**
- **Visual source of truth:** `_legacy/app/**` (routes) and `_legacy/src/features/**` (screens). For every screen, port the markup, spacing, copy and component structure from the matching legacy file. Do not redesign anything.
- **Data rule:** demo screens show data from `_legacy/src/data` / `_legacy/src/lib`. In the new app, the same UI must show real Supabase rows. Every list needs an empty state that *looks like the demo card* (same card, same layout) and must not collapse into a grey placeholder.
- Branch: `feat/clean-architecture`. Uncommitted work in `src/features/fields/*` and `globals.css` (satellite map style) — keep it.
- Screenshots that come with this file (390 px mobile + 1440 px desktop): `demo-m-*.png`, `demo-d-*.png`, `local-en-m-*.png`, `local-en-d-*.png`, `local-el-m-*.png`, side-by-side in `sbs/`.

---

## P0 — Global, fix first (affects every screen)

1. **Wrong font everywhere (Times New Roman instead of Inter)** — P0
   - Demo: Inter (400/500/600/700/800) everywhere.
   - Local: every page renders in the serif fallback. Confirmed in Chrome: `html` computes `font-family: "Times New Roman"`, and the user's own Edge screenshot shows the same.
   - Cause: `src/app/layout.tsx` puts `inter.variable` (defines `--font-sans`) on `<body>`. `globals.css` applies `font-sans` on `html`, and `@theme inline { --font-sans: var(--font-sans) }` refers to itself, so `html` never gets the variable.
   - Fix: in `src/app/layout.tsx`, rename the next/font variable to `--font-inter` and put the classes on `<html>`: `<html lang={locale} className={`${inter.variable} ${geistMono.variable}`}>`. In `globals.css`, `@theme inline { --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif; --font-heading: var(--font-sans); }`. Load weights 400–800. Also set `<html lang>` from the locale; it is hard-coded to `el` right now.

2. **Extra top app bar on mobile that the demo doesn't have** — P0
   - Demo (farmer, mobile): no header. Each screen starts with its own title row ("Good morning, Mehmet" + settings/bell, "My Field" + back + layers, and so on). Only the bottom tab bar is shared.
   - Local: `src/shared/components/app-shell.tsx` adds a sticky header (leaf logo + "AgroPulse" + language `<select>` + "Sign out") above every farmer screen. That pushes content down and breaks the look.
   - Fix: remove the header from the farmer shell. Move the language switch and sign-out into the settings (gear) sheet on Home, or into a `/farmer/settings` page. Keep only the bottom tab bar.

3. **Desktop layout of the farmer app is different** — P0
   - Demo at ≥ 1024 px: the farmer app sits inside a **centred iPhone frame** (status bar 9:41, dynamic island, home indicator) on a light-blue stage (`--stage`). "⇆ Switch view" sits top-left. See `demo-d-farmer*.png` and `_legacy/app/farmer/_layout.tsx` / `_legacy/app/_layout.tsx` (web phone frame).
   - Local at desktop: a left sidebar (Home/Fields/Scan/Logbook/Market) and a full-width page (`local-en-d-*.png`).
   - Fix: in `FarmerShell`/`AppShell`, drop the desktop sidebar for the farmer role and render the mobile layout inside a phone-frame component at `md:` and up, with the same "Switch view" link as the demo.

4. **Bottom tab bar** — P0
   - Demo labels: **Home · Field · Scan · Logbook · Market** ("Field", singular). Icon circle: dark green for every active tab. Labels are 11–12 px Inter, bold when active.
   - Local: "Fields" (plural, `farmerNav.fields`). Labels look bigger because of the serif fallback. Logbook/Market use an `ink` circle.
   - Fix: change `farmerNav.fields` in en/el/tr to the singular (`Field` / `Χωράφι` / `Tarla`). Check the circle colour against `_legacy/app/farmer/(tabs)/_layout.tsx` and use the demo's colour.

5. **Missing translations in Add-field (raw keys on screen + ~33 console errors)** — P0
   - Local `/en/farmer/fields/new` shows `farmerFields.addTitle`, `FARMERFIELDS.CROPNOW`, `farmerFields.spray0`… The Next dev overlay reports "33 issues" (`IntlError: MISSING_MESSAGE`).
   - Keys missing in **all three** `src/shared/i18n/messages/{el,en,tr}.json` under `farmerFields`: `addTitle, cropNow, growing, almost, harvested, lastSeason, sprays, spray0, spray12, spray3, records, recNone, recPaper, recB, bNote, proofFor, proofField, proofOlives, proofQty, proofExpected, proofSpray, proofSales, added, required, optional, noted, missingProof, startingScore, estimated, scoreFrom, selfReported, evidenceBased, labVerified, shownBuyers, startSelling, drawBoundary, stageGrowing, stageAlmost, stageHarvested`. Grep `add-field-screen.tsx` for the full list.
   - English copy to use (from the demo): "Add your field", "WHERE IS YOUR CROP NOW?", "Growing / Almost ready / Harvested", "LAST SEASON", "Sprays 0 / 1–2 / 3+", "Records None / Paper / B-Reçete", "B-Reçete: the official pesticide prescription (Türkiye).", "PROOF FOR A HARVESTED CROP", "Olives photo / Quantity / Spray receipt / Sales receipt", "ADDED / REQUIRED / OPTIONAL", "Starting score", "ESTIMATED", "From answers, photos and satellite history", "Self-reported / Evidence-based / Lab verified", "Shown to buyers who can pick up within 48 h.", "Start selling". Add Greek and Turkish too.
   - Also add a CI check (vitest) that every `t("…")` key exists in all locales.

6. **Processor pages crash when Supabase env is missing** — P0 (robustness)
   - `src/features/auth/processor-shell.tsx` calls `createClient()`, which **throws** ("Missing NEXT_PUBLIC_SUPABASE_URL…"). Every `/processor/*` page then shows "Application error". Farmer screens use `tryCreateBrowserClient()` and degrade gracefully.
   - Fix: use `tryCreateBrowserClient()` in `processor-shell.tsx` (and anywhere else `createClient()` is called client-side).

7. **Disable the Next dev indicator** in screenshots/demos (`next.config.ts` → `devIndicators: false`). The "N" bubble covers the "Home" tab.

---

## Routes — demo vs local

| Demo route (Expo) | Local route (Next) | Status |
|---|---|---|
| `/` landing: "From healthy groves to direct sales", cards "Farmer app" / "Processor panel" | `/[locale]` → redirects to `/login` | **Missing** (P1). Demo has no login. Build the landing page and send the CTAs to login/register (or straight into the app when a session exists). |
| `/farmer/onboarding` (step 1: field name, map polygon, "Use my location", trees ±, tree age, variety chips, irrigated yes/no, Next) | `/farmer/fields/new` shows only step 2 (crop) plus a "drawBoundary" link | **Step 1 missing** (P0) |
| `/farmer/onboarding/crop` (step 2) | part of `/farmer/fields/new` | Partly there; i18n broken (see #5) |
| `/farmer` (Home tab) | `/farmer/dashboard` | Renamed. Add a redirect `/farmer` → `/farmer/dashboard`, or rename the route to `/farmer` (P1) |
| `/farmer/field` | `/farmer/fields` | Renamed (add an alias/redirect) |
| `/farmer/scan` list, `/farmer/scan/camera`, `/farmer/scan/analysing`, `/farmer/scan/result/[id]` | `/farmer/scan` only (camera, analysing, result are internal `view` state in `scan-screen.tsx`) | **Deep-link routes missing** (P1). The back button and refresh lose state, and the Scan list can't link to a result. |
| `/farmer/logbook` | `/farmer/logbook` | Same route |
| `/farmer/market` + `/market/requests`, `/market/offers`, `/market/sales` (tabs are routes) | `/farmer/market` with in-page tabs | Make the tabs URL-driven (`?tab=` or subroutes) (P2) |
| `/farmer/market/new` | `/farmer/market/new` | Same route, but local only shows "Add a field before publishing" |
| `/farmer/alerts`, `/farmer/alert/[threat]` (threat detail) | `/farmer/alerts` only | **`/farmer/alert/[threat]` missing** (P1) |
| `/farmer/quality`, `/farmer/tasks` | same | Same route |
| `/processor` (Overview) | `/processor/overview` | Renamed (add a redirect) |
| `/processor/lots`, `/processor/lots/[id]`, `/processor/requests`, `/processor/deliveries` | same | Same route |
| — | `/processor/offers`, `/login`, `/register` | Extra in local (fine to keep; style them like the demo) |

---

## Screen-by-screen

### Home — demo `/farmer` vs local `/farmer/dashboard` (`src/features/home/dashboard-screen.tsx`)
8. **P1** Greeting: the demo shows "Good morning, **Mehmet**" with a location line ("📍 Germencik, Aydın"). Local shows "Good afternoon, **grower**" and "Add a field". Use `profiles.display_name`. Use the location of the first field (reverse geocode or `fields.region`).
9. **P1** Field chips row under the greeting ("All fields · 3", "● North grove", "● River plot", "● Hill" with health-coloured dots). Local has no chips. Render them from `fields`, with the dot colour taken from the risk level.
10. **P1** Weather pill: demo "☁ 20°C Cloudy | 💧 Rain tomorrow". Local "— | Weather unavailable" and a red "Supabase not configured" text. Remove the raw red debug text from the UI and use a toast or a dev-only log instead.
11. **P1** Hero "FIELD CHECK · TODAY" card: demo uses a **salmon/risk background** when the risk is high, a field badge ("River plot · 140 trees"), the title "Olive fly risk is high", an "AI · Gemini" chip, a **terracotta "Take a photo" button** and "2 / 5 tasks". Local uses a grey card and a black button. Colour the card and button by risk level as in `_legacy/src/features/home/*`.
12. **P1** Summary chips "4 risks / 1 re-check / 3 offers" must link to /farmer/alerts, /farmer/scan, /farmer/market/offers. Fill them from the risk engine, `scans` (re-check due) and `offers`.
13. **P1** "Your fields" horizontal cards (icon, name, "120 trees · 1.1 ha", score badge, "Olive fly · Medium", "Safe to harvest · 12 days"). Local only shows text.

### Field — demo `/farmer/field` vs local `/farmer/fields` (`fields-screen.tsx`, `field-health-map.tsx`)
14. **P1** Chips row "North grove | River plot | Hill | + Add". Local shows only "+ Add".
15. **P1** Stats card "120 trees · Tree count | 1.1 ha · Field size | ★ Quality score 68 / 100 (salmon)". Local shows "— / —". Read them from `fields` (`tree_count`, `area_ha` via PostGIS) and `quality_scores`.
16. **P0** Map: demo shows a satellite view with the field polygon (white outline) and **tree dots coloured Healthy/Suspicious/Diseased**, the selected tree marked "#23", a locate button and zoom ± buttons. On a box without a token, local shows a black panel with "Set NEXT_PUBLIC_MAPBOX_TOKEN…". Keep Mapbox, but (a) render `field_trees` points with the 3 colours, (b) when there is no token, show a static fallback styled like the demo, never raw env text.
17. **P1** "3 trees need follow up · View" banner and the Tree card ("Tree #23 · High risk · Peacock spot · Last photo · Last spray · Re-check in 4 days · Scan this tree / See all scans"). These need `field_trees.health`, the last scan per tree and the last logbook entry.

### Onboarding / Add field — demo `/farmer/onboarding` + `/crop` vs local `/farmer/fields/new` (`add-field-screen.tsx`)
18. **P0** Build **step 1** exactly like the demo: header "Add your field" with a 3-segment progress bar; "FIELD NAME" input with mic icon and placeholder "For example: Hill"; "DRAW YOUR FIELD ON THE MAP" map card with a "Use my location" button and a location/area pill ("Germencik, Aydın · 0.6 ha"); "✦ Satellite found about 80 trees inside your field."; "Number of trees" stepper (− 80 +); "Tree age" (20–50 years); "Olive variety" chips (Ayvalık/Memecik/Gemlik/Other); "Is the field irrigated? Yes/No"; full-width black "→ Next" button pinned to the bottom.
19. **P0** Step 2 (crop) is already ported, but fix #5 (i18n). Also: chips/toggles overflow the card at 390 px (the "Sprays 0 / 1–2 / 3+" row runs off-screen in `local-en-m-farmer_fields_new.png`). The "Start selling" button must be full-width black and pinned to the bottom. Hide the tab bar during onboarding, as the demo does.
20. **P0 backend** Pass the step 1 values to `rpc("create_field_from_geojson")`. Today `p_variety: null`, and tree count, tree age and irrigation are not sent. Add the columns/params if missing (`fields.variety`, `tree_count`, `tree_age_band`, `irrigated`, `crop_stage`, `sprays_last_season`, `records_type`), plus a `field_evidence` table/storage for the proof photos and the starting score.

### Scan — demo `/farmer/scan*` vs local `/farmer/scan` (`src/features/diagnostics/scan-screen.tsx`)
21. **P1** List: demo has field filter chips, a "Tree #23 · Peacock spot · Improving" before/after photo comparison card, groups per field ("North grove · 1 re-check due") and rows with thumbnail + status pill (Re-check / Healthy / Medium risk / Watch). Local: "All · 0" and an empty card. **Scans are only kept in React state** (`useState<SavedScan[]>([])`), so a refresh loses them. Persist them to `scans` (+ a Storage bucket for images) and load them from there.
22. **P1** Camera screen (`/farmer/scan/camera`): mode tabs Leaf / Fruit / Trap / Label, the field name, "Choose a photo", "Use sample photo", frame hint "Place one leaf inside the frame", privacy note. Give this its own route.
23. **P1** Result screen (`/farmer/scan/result/[id]`): title, field + time, diagnosis card (name, Latin name, "High risk", confidence sentence, explanation), "What you can do now" action list (No chemicals first / Prune for airflow / Remove fallen leaves / Re-check in 7 days), "Save to North grove", "Ask an agronomist". The demo shows a "Demo result" banner when the AI fails. Keep that fallback.

### Logbook — `/farmer/logbook` (`logbook-screen.tsx`)
24. **P1** Field chips row (missing locally). Two stat cards: "Safe to harvest **12 days**" and "Sprays this year **3** · Nearby farms: 4".
25. **P1** EU card: "EU spray record: complete" + red "1 issue: banned product on 29 Oct" + Share.
26. **P1** Timeline with coloured dots: banned entry in a red card ("Not allowed", chlorpyrifos explanation); allowed entries with a green "Approved for olives · Licence … · Growth stage …" box. Entries are local `useState` only → persist them to `logbook_entries` and run `eu-check.ts` server-side.
27. **P2** The FAB "Add a spray" is **black** in the demo and dark in local. Check the icon (camera) and the position.

### Market — `/farmer/market` (+ requests/offers/sales) (`farmer-market-screen.tsx`, `new-listing-screen.tsx`)
28. **P1** Tabs: the demo shows a red count badge on "Offers 3". Make the tabs URL-driven (see Routes).
29. **P1** Overview: "Best offer" card (initials avatar "NO", buyer name, ★ rating, "€1.00 /kg", "Above range" pill, Counter/Accept); "Your fields" **2-column grid** of field price cards (score badge, "€0.75–€0.90 /kg · exchange price range", "1 issue: banned product" or "3 offers ›", "List now ›"); "Factories looking to buy" rows. Local shows empty placeholders → fill from `offers`, `lots` and `buy_requests`.
30. **P1** Requests tab: "Prices are going up this week" banner, filter chips (Fits my fields / Near me / Ayvalık / Aydın), fit banner, request cards with "Offer", co-op "Combine with 3 nearby farmers… Join".
31. **P1** Offers tab: in-progress delivery card with a 5-step tracker (Agreed → Picked up → Weighed → Lab check → Paid), offers list for a field with Counter/Accept.
32. **P1** Sales tab: "Paid this season €2,450 / On the way €900 / Wallet", in-progress card, completed list with "Receipt".
33. **P1** New listing: the demo always shows the selected field card (variety, trees, readiness, banned check, score), amount, harvest period, negotiation toggle, delivery (Factory picks up / I deliver), price range, "Your price per kg", "Publish listing". Local only shows "Add a field before publishing". Keep that guard, but build the full form → insert into `lots`.
34. **Backend** Accept/Counter must write to `offers` (status, counter_price) and create `deliveries` on accept. Realtime notifies the processor (the demo states "Offers accepted in the farmer app appear in the processor panel").

### Alerts — `/farmer/alerts` + missing `/farmer/alert/[threat]` (`alerts-screen.tsx`)
35. **P1** Demo header: back arrow + "Alerts" + gear; segmented tabs **Pests / Weather / Location**; field chips; "✦ Advisor" card (risk pill, bold summary, ✓ action list, weather sentence, "AI · Gemini"); "7-day forecast" bar chart with day labels and risk words; "Rule-based forecast from live weather · updated 1 min ago"; "Recent alerts" list → tapping a row opens `/farmer/alert/[threat]`. Local shows a subtitle ("Risk by category…") and a generic "No fields" card. With fields present, render the demo layout from `features/weather-risk/risk` + `/api/ai/advise`.
36. **P1** Port `_legacy/app/farmer/alert/[threat].tsx` (threat detail page).

### Quality — `/farmer/quality` (`quality-screen.tsx`)
37. **P1** Demo: back + title, field chips, donut "68 % Quality score", "Buyers see this score on your listings.", red delta box "12% lower than last month" + reason; "Score breakdown" (Tree health / Safe spraying / Harvest timing / Records kept with % and pills); "Your feedback helps the forecast learn"; "AI Plan to Increase the Score" numbered steps with +points. Local only shows the "Field required" card; no subtitle in the demo. Back it with `quality_scores` (+ history for the delta) and `/api/quality/score`.

### Tasks — `/farmer/tasks` (`tasks-screen.tsx`)
38. **P1** Demo: "Checks done **2 of 5**" with progress bar and "+2 score"; task cards with icon, field + due date, "+1" pill, AI hint box, buttons **auto-width pill** ("Take photo", "Yes, add it" / "No", "Re-check now"); completed tasks struck through with the field name. Local: full-width grey disabled buttons and "Shows up when a task is due" placeholders. Read from `tasks` and generate them from risk/scans. Match the button sizing.

### Processor panel — `/processor/*` (`processor-shell.tsx`, `processor-screens.tsx`, `processor-kit.tsx`)
39. **P0** Crash without env (see #6).
40. **P1** Logo: the demo uses the **"Λ" pulse mark on a black rounded square** + "AgroPulse" (same on the landing). Local uses a green circle with a leaf icon. Use the demo mark (and the same in the farmer app if it appears).
41. **P1** All processor strings are hard-coded English in `processor-screens.tsx` (`"Overview"`, `"Find olives"`, `"Scheduled"…`) → move them to next-intl like the farmer screens.
42. **P1** Overview stats/offers/supply-outlook are hard-coded `"0"` and empty → query `buy_requests`, `offers` (incoming, anonymised until accepted), `deliveries` and `lots` (harvest windows per region) plus the risk engine. Overview nav item has a red count badge ("Overview 4"). Show "Demo price €0.80 /kg" or the exchange-price pill.
43. **P1** Lots (Find olives): filters (All / For oil / Table olives, Variety, Province, Min quality score, No banned products, Lab test suggested), "12 lots · Best quality score first", lot cards with badges + score + "Open to offers". Lot detail `/processor/lots/[id]`. Requests: "New request" + request cards with % filled progress. Deliveries: Active/Completed tabs, step tracker, "Record weighbridge", "Mark lab checked", "Download traceability report".

### Landing, login, register
44. **P1** Port the demo landing (`_legacy/app/index.web.tsx`): logo, headline "From healthy groves to direct sales", two illustrated cards (Farmer app / Processor panel) with black pill CTAs, footnote. Point the CTAs to `/login?role=…` / `/register`.
45. **P2** Login/register cards: style them like the demo (Inter, 16 px rounded cards, black pill primary button, demo spacing). They currently look like default shadcn with a serif font. At 390 px the card overflowed horizontally in the Edge screenshot on the user's PC — check `auth-form.tsx` widths (`w-full max-w-sm mx-auto`).

### i18n
46. **P2** The demo is English-only, with Turkish place names. Local supports el/en/tr with default `el`. Keep that, but every demo string must exist in all 3 locales (see #5), and the language switch belongs in settings, not in a header (see #2).

---

## Backend endpoints/tables the frontend needs (missing or not wired)
Already present: `/api/ai/advise`, `/api/ai/diagnose`, `/api/ai/read-label`, `/api/quality/score`, `/api/satellite/ndvi`, `/api/weather`, `/api/auth/register`, rpc `create_field_from_geojson`, tables `profiles, fields, field_trees, scans, logbook_entries, quality_scores, tasks, risk_snapshots, lots, buy_requests, offers, deliveries`.

Not wired yet: the UI never reads or writes these tables. Only `profiles` and `fields` are queried today.

| Need | Suggested implementation |
|---|---|
| Field create with full onboarding data | Extend `create_field_from_geojson` params (variety, tree_count, tree_age, irrigated, crop_stage, sprays, records) + `field_evidence` uploads → returns `starting_score` |
| Tree points for health layer | `GET fields/:id/trees` (select from `field_trees`, PostGIS → GeoJSON), auto-seed from satellite tree detection if available |
| Scans list/detail | `scans` insert in `/api/ai/diagnose` (store image in Storage `scans/` bucket), `GET` list per field, `GET /scan/:id`, re-check due date |
| Logbook | insert/select `logbook_entries`, EU check server-side, "Safe to harvest N days" (PHI) computed from last spray |
| Tasks | generate from risk + scans (cron/edge function), `PATCH` complete/answer |
| Alerts | `risk_snapshots` per field per day (7-day forecast), threat detail by `threat` |
| Quality | persist `quality_scores` history (for "12% lower than last month") |
| Market farmer | lots CRUD, offers list per field, accept/counter, sales/wallet sums from `deliveries` |
| Processor | lots search with filters + anonymisation until accepted, buy_requests CRUD with fill %, offers in/out, deliveries step updates + traceability report (PDF) |
| Realtime | subscribe `offers`/`deliveries` so farmer accept shows up in the processor panel |
| Seed | `supabase/seed.sql` that reproduces the demo dataset (Mehmet; North grove/River plot/Hill; Northgate Olive Co., Sunridge Oil Mill, Valley Press Co., Harbor Soap Works; Demo Olive Oil Co. processor) so the new app can be compared 1:1 with the demo |

## Suggested order
1. #1 font, #2 header, #4 tab labels, #5 i18n keys, #6 processor crash, #7 dev indicator (≈1 h, instantly looks much closer).
2. Seed data (`supabase/seed.sql`) matching the demo, so every screen can be compared with real rows.
3. Onboarding step 1 (#18–20) and the Field map tree layer (#16).
4. Persist scans/logbook/tasks, then the market/processor wiring.
5. Desktop phone frame (#3), landing (#44), deep-link routes.
