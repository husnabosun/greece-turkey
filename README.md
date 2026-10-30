# AgroPulse

Mobile app demo for small olive farmers in Türkiye and Greece. Farmers record field care (sprays, photos, checks); the app turns it into a quality score and a fair price, and sells olives to factories through a marketplace.

This is a **clickable demo on mock data**. One codebase for web, iOS and Android (Expo + React Native + TypeScript, expo-router, NativeWind, zustand).

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

Leaf scans do **not** use Gemini. They are meant for our own leaf model (see `research/`); until that model is connected they show the demo result.

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

### Safety and limits

- Every prompt forbids naming pesticides, active substances and doses. The server also scans the text and drops an answer that names a chemical, gives a dose, has more than 2 sentences in the summary, or contains numbers that are not in the data it was given.
- Photos are resized on the phone to at most 1024 px and 1 MB before upload; the server rejects larger ones. Under every photo upload the app says: "Photos are sent to an AI service only to analyse them."
- The rate limit (20 calls per 10 minutes per device) lives in the memory of one server instance. It stops loops, not abuse. Before a public launch, add a shared store (for example Upstash Redis) and sign-in.
- The EU list in `src/lib/euCheck.ts` is a short demo list, not the legal register.

## Project layout

```
app/                  expo-router routes (thin: they only show feature screens)
src/components/       shared UI (Card, Pill, Button, tab bar, phone frame, ...)
src/features/         screens by feature: home, field, scan, logbook, market, quality, alerts, tasks, onboarding
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
