# Agro Pulse AI

Production rebuild of the Greece–Türkiye olive AgriTech & B2B supply-chain platform.

> The archived Expo clickable prototype lives in `_legacy/` (read-only domain/UX reference).  
> Do **not** import Expo / React Native / NativeWind from `_legacy/`.

## Stack

- Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Lucide
- Supabase (Auth, Postgres + PostGIS, Storage, Realtime) — Phase 2
- Mapbox GL JS · Open-Meteo · AgroMonitoring · Google Gemini 2.5 Flash — Phase 3+
- Zustand · Zod · next-intl (`el` / `tr` / `en`)
- PWA-ready (`src/app/manifest.ts`)

## Run locally

```bash
npm install
cp .env.example .env.local   # fill keys when ready; app boots without them
npm run dev
```

Open [http://localhost:3000/el](http://localhost:3000/el).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js + Turbopack |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Architecture

See feature-based layout under `src/` (`app/`, `features/`, `shared/`, `core/`) and SQL migrations under `supabase/migrations/`.

### Database (Phase 2)

PostGIS-enabled schema with RLS for `farmer` / `processor`, storage buckets, and Realtime on offers/deliveries/lots.  
Apply with `npx supabase db push` — details in [`supabase/README.md`](supabase/README.md).

### APIs & engines (Phase 3)

| Endpoint | Engine |
|---|---|
| `GET/POST /api/weather` | Open-Meteo (+ 1h cache, demo fallback) |
| `POST /api/satellite/ndvi` | AgroMonitoring (demo without key) |
| `POST /api/ai/diagnose` | Gemini 2.5 Flash · leaf / fruit / trap |
| `POST /api/ai/read-label` | Gemini OCR + EU `euCheck` |
| `POST /api/ai/advise` | Gemini advisor + safety filter |
| `POST /api/quality/score` | Pure TS quality score engine |

Domain ports from `_legacy`: `features/weather-risk`, `features/logbook`, `features/marketplace`.  
`npm test` runs Vitest (risk, EU check, quality, safety).

### UI (Phase 4)

| Area | Routes |
|---|---|
| Auth | `/[locale]/login`, `/[locale]/register` |
| Farmer PWA | `/farmer/dashboard`, `fields`, `scan`, `logbook`, `quality`, `market` |
| Processor B2B | `/processor/overview`, `lots`, `lots/[id]`, `offers`, `deliveries` |

Open [http://localhost:3000/el](http://localhost:3000/el). Weather/risk/scan/quality hit live APIs; Mapbox/Supabase need keys.
