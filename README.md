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

## Live data and the network

- **Weather** comes from [Open-Meteo](https://open-meteo.com) (free, no key). It is cached for 1 hour. Without internet the app uses the last cache, then built-in demo weather, so it always works.
- Everything else (fields, sprays, offers, factories) is mock data in `src/data/mock.ts`. There is no backend.
- Camera: on a phone or a browser with a camera it uses the live camera. Without permission it falls back to "Choose a photo" or "Use sample photo".

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
