# AgroPulse

Mobile app demo for small olive farmers in Türkiye and Greece. Farmers record field care (sprays, photos, checks); the app turns it into a quality score and sells olives to factories through a marketplace. The farmer sets the price; the app only shows today's range of the local commodity exchange (sample data) next to it.

This is a **clickable demo on mock data**. One codebase for web, iOS and Android (Expo + React Native + TypeScript, expo-router, NativeWind, zustand).

## How to try the demo

Open the site and choose a view on the landing page (`/`). Everything is sample data. No sign-in, no real companies.

| Route | What you see |
|---|---|
| `/` | Landing page: Farmer app or Processor panel |
| `/farmer` | Home: today's risk, weather, tasks. Tabs: `/farmer/field`, `/farmer/scan`, `/farmer/logbook`, `/farmer/market` |
| `/farmer/market/offers` | Offers from factories. Accept one and it becomes a sale |
| `/farmer/quality`, `/farmer/alerts`, `/farmer/tasks` | Quality score, risk alerts, this week's checks |
| `/processor` | Overview: incoming offers, supply outlook |
| `/processor/lots`, `/processor/lots/lot-ay2` | Find olives, lot detail with "Make offer" |
| `/processor/requests`, `/processor/deliveries` | Requests to farmers, deliveries (weighbridge, lab check, paid) |

**Connected demo (2 minutes):** in the processor panel open `/processor/lots/river` and press **Make offer**, then **Send offer**. Use **Switch view**, open the farmer app, go to Market, Offers, and press **Accept** on the new offer. Switch back to the processor panel, open **Deliveries**, and press **Record weighbridge**, **Mark lab checked** and **Mark paid**. The state lives in the open browser tab: a reload starts the demo again.

## Run it locally

You need **Node 20 or newer** (22 works) and npm. No `.env` file and no API keys are needed.

```bash
git clone <repo-url>
cd <repo-folder>
npm install
npx expo start --web      # opens http://localhost:8081
```

- On a wide browser window the app shows inside a phone frame. On a narrow window or a phone it is full screen.
- **On your phone:** install **Expo Go**, put the phone and the computer on the same Wi-Fi, run `npx expo start`, and scan the QR code (Camera app on iPhone, Expo Go on Android). If it cannot connect, use `npx expo start --tunnel`.
- If the page looks old after pulling changes: `npx expo start --web --clear`.

## Useful commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests for the logic in `src/lib` (risk engine, weather, scans, prices, onboarding score, feedback) |
| `npm run typecheck` | TypeScript check |
| `npm run risk-report` | Prints today's risk table per field from live weather (needs internet) |
| `npx expo export -p web` | Builds the website into `dist/` |
| `npm run api` | Runs the AI server (`/api`) on http://localhost:3001 with the key from `.env` |
| `npm run ai:demo -- label.jpg trap.jpg` | Prints a label read, a trap count and the advisor text (Turkish and Greek) with your real key |

## Live data and the network

- **Weather** comes from [Open-Meteo](https://open-meteo.com) (free, no key). It is cached for 1 hour. Without internet the app uses the last cache, then built-in demo weather, so it always works.
- Everything else (fields, sprays, offers, factories) is mock data in `src/data/mock.ts`. There is no backend (for now).
- Camera: on a phone or a browser with a camera it uses the live camera. Without permission it falls back to "Choose a photo" or "Use sample photo".

## AI with Google Gemini (through our own server)

The app never talks to Gemini directly. Photos and numbers go to three small serverless functions in `api/`, which hold the key, call Gemini, check the answer and return strict JSON. If anything fails (no key, timeout after 15 s, bad answer, rate limit), the function returns `{ "ok": false }` and the app shows the old demo result with a **Demo result** tag.

| Endpoint | Used by | Returns |
|---|---|---|
| `POST /api/read-label` | Logbook, "Scan the label" | product name, active substances, licence, max dose per ha, pre-harvest days, crops, confidence. The app runs the EU check (`src/lib/euCheck.ts`) and fills the Add spray form |
| `POST /api/diagnose-fruit-trap` | Scan, Fruit and Trap modes | fruit: diagnosis (olive fly sting / other damage / healthy / unclear); trap: fly count. The count is saved on the scan and feeds the risk engine |
| `POST /api/advise` | Home "Today" card and Alerts | summary (max 2 sentences), up to 3 actions, why now, in EN / TR / EL. It only explains the numbers of our risk engine |

Leaf scans do **not** use Gemini. They use our own leaf model, which runs in a Hugging Face Space (see "Leaf model" below). The fourth endpoint is `POST /api/diagnose-leaf`.

### Set the key locally

1. Copy `.env.example` to `.env` (`.env` is in `.gitignore`) and put your key in `GEMINI_API_KEY=`. Get one at <https://aistudio.google.com/apikey>.
2. Start the AI server: `npm run api` (or `npx vercel dev --listen 3001` if you use the Vercel CLI). It listens on http://localhost:3001.
3. In another terminal start the app: `npx expo start --web`. The app finds the server through `EXPO_PUBLIC_API_URL=http://localhost:3001` (already in `.env.example`; it is only an address). On a real phone use your computer's network address instead of `localhost`.
4. Optional: `GEMINI_MODEL=...` pins a model. The default is `gemini-flash-latest`, the current Flash model with vision.

**Never put the key in a variable that starts with `EXPO_PUBLIC_`.** Expo copies those into the app that everybody downloads.

### Set the key on Vercel

1. Push the repo to GitHub and import it at <https://vercel.com/new>. `vercel.json` already sets the build (`npx expo export -p web`), the output folder (`dist`) and the 20 s function limit.
2. In the project: Settings, Environment Variables. Add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) for Production and Preview. Leave `EXPO_PUBLIC_API_URL` empty: the website and `/api` share one domain.
3. Redeploy. Check it: `curl -X POST https://<your-site>/api/advise` should answer `{"ok":false}` with status 400 or 405, not an HTML page.

### Leaf model (our own, on Hugging Face)

`POST /api/diagnose-leaf` sends a leaf photo (base64 JPEG, at most 1024 px, resized in the app) to the Space `hupus/agropulse-leaf` with `@gradio/client` (api_name `predict`) and answers `{ ok, source: "model", label, confidence, top3, modelVersion }`. After 60 s, or on any error, it answers the demo result with `source: "demo"`, and the Scan screen marks it "Demo result".
Set `HF_TOKEN` (a Hugging Face read token) in `.env` and in Vercel (Settings, Environment Variables, Production and Preview). It is server only: never give it an `EXPO_PUBLIC_` prefix. The first call after the Space slept can take up to a minute; the Scan screen then says "Waking up the AI model…". `LEAF_MODEL_VERSION` in `src/lib/ai/leaf.ts` is the version shown on the result ("Model: AgroPulse leaf v2"). Below 60 % confidence the app asks for a new photo.
Check it in a browser with `scripts/leaf-scan-check.mjs`.

### Environment variables on Vercel

Names only (set them under Settings, Environment Variables, for Production and Preview; Development is only needed for `vercel dev`):

| Name | Needed for | Public? |
|---|---|---|
| `GEMINI_API_KEY` | label scan, fruit/trap scan, advisor | No, server only |
| `HF_TOKEN` | leaf model in the Hugging Face Space (more daily GPU quota than anonymous calls) | No, server only |
| `GEMINI_MODEL` | optional, pins a Gemini model | No |
| `EXPO_PUBLIC_API_URL` | leave unset on Vercel (the site and `/api` share a domain) | Yes, an address only |

Without the keys the app still works: every AI feature shows a clearly marked **Demo result**.

### Safety and limits

- Every prompt forbids naming pesticides, active substances and doses. The server also scans the text and drops an answer that names a chemical, gives a dose, has more than 2 sentences in the summary, or contains numbers that are not in the data it was given.
- Photos are resized on the phone to at most 1024 px and 1 MB before upload; the server rejects larger ones. Under every photo upload the app says: "Photos are sent to an AI service only to analyse them."
- The rate limit (20 calls per 10 minutes per device) lives in the memory of one server instance. It stops loops, not abuse. Before a public launch, add a shared store (for example Upstash Redis) and sign-in.
- The EU list in `src/lib/euCheck.ts` is a short demo list, not the legal register.

## Two views: farmer app and processor panel

One demo link, two views. Both read the same zustand store, so what happens in one shows in the other (no reload needed when you use the "Switch view" links).

| URL | What | Where |
|---|---|---|
| `/` | Landing page: choose a view | web only |
| `/farmer/...` | Farmer app (Home, Field, Scan, Logbook, Market, ...) | web, iOS, Android |
| `/processor` | Overview (stats, incoming offers) | web only |
| `/processor/lots`, `/processor/lots/[id]` | Find olives, Lot detail (Make offer, Request lab test) | web only |
| `/processor/requests` | My requests, New request | web only |
| `/processor/deliveries` | Deliveries (weighbridge, lab check, paid, traceability report) | web only |

- iOS and Android open straight into `/farmer`. The landing page and the processor routes are web only (`app/index.web.tsx`, and `app/processor/_layout.tsx` redirects on native).
- The processor side shows only the public exchange price, labelled "Demo price". It never shows a fair or recommended price.
- Connections: an offer the processor makes shows up in the farmer's Market > Offers; accepting it creates a delivery in the processor panel; a request the processor creates shows up in Market > Requests; a listing the farmer publishes is an incoming offer in the processor Overview.
- Overview has a supply outlook (tonnes per region and week from the harvest dates of the lots, plus the pest risk this week from the risk engine, using the weather of each region). Lots show up to two badges per row, most important first: "Lab test suggested" (high pest risk in the area and no lab result yet, or incomplete spray records), "No banned products", "Reliable delivery", "Complete records" (`src/lib/badges.ts`, `src/lib/processor.ts`). All badges are shown on the lot page. Places are always "District, Province" and varieties "Ayvalık olives".
- The season risk chart on the lot page comes from the real risk engine: `npx tsx research/scripts/season-risk.ts` turns `research/data/backtest.csv` into `src/data/seasonRisk.ts`.
- `node scripts/processor-screenshots.mjs` (after `npx expo export -p web`) takes the screenshots in `screens/processor/` and clicks through the connected demo.

## Project layout

```
app/                  expo-router routes (thin: they only show feature screens)
  index.web.tsx       landing page (web)      index.tsx  redirect to /farmer (native)
  farmer/             the farmer app: (tabs), market, quality, alerts, tasks, onboarding, scan
  processor/          the processor panel (web only)
src/components/       shared UI (Card, Pill, Button, tab bar, phone frame, ...)
src/features/         screens by feature: home, field, scan, logbook, market, quality, alerts, tasks, onboarding, landing, processor
src/data/mock.ts      seed data
src/state/            zustand store, weather and risk hooks
src/lib/              pure logic with tests: risk engine, weather, scans, prices, onboarding score, feedback
scripts/              developer tools
screens/              design PNGs (what each screen must look like)
CLAUDE.md             project rules (tech, design tokens, content rules)
```

The risk engine's thresholds live in `src/lib/risk/config.ts`. They are starting heuristics and need an agronomist to check them.

## Notes

- The "Was this right?" answers are saved on the device (AsyncStorage) as future training data. `exportFeedback()` in `src/lib/feedback.ts` turns them into JSON.
