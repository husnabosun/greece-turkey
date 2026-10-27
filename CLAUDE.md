# AgroPulse – project rules

AgroPulse is a mobile app for small olive farmers in Türkiye and Greece.
Farmers record their field care (sprays, photos, checks); the app turns these records
into a quality score and an AI fair price, and sells the olives directly to olive oil
factories through a marketplace.

Right now this is a **clickable demo on mock data** for a hackathon, published as a website.
The same code must later become an iOS/Android app without rewriting the UI.

## Tech (do not change without asking)
- **Expo (latest SDK) + React Native + TypeScript**, one codebase for web, iOS and Android.
- **expo-router** for navigation (file-based routes, tab layout for the 5 main tabs).
- **NativeWind v4** (Tailwind classes for React Native) for styling. Design tokens live in `tailwind.config.js`
  and `src/theme/tokens.ts`.
- **zustand** for app state (fields, sprays, offers, sales) so actions in the demo update every screen.
- Icons: `lucide-react-native` (+ `react-native-svg`). Font: Inter via `@expo-google-fonts/inter`.
- No backend. Seed data in `src/data/mock.ts`.

## Cross-platform rules (important)
- Use only React Native primitives: View, Text, Pressable, ScrollView, FlatList, Image, TextInput, Modal.
  **No HTML tags (div, span, button), no DOM APIs, no web-only libraries.**
- Anything platform-specific goes behind `Platform.OS` or a `.web.tsx` / `.native.tsx` file.
- Maps: for now a static aerial image with absolutely positioned tree dots (works everywhere).
  Do not add react-native-maps yet.
- Camera/photo: use `expo-image-picker` (works on web and mobile). In the demo, fall back to a sample photo.
- Keep business logic (score, price, matching) in plain TypeScript under `src/lib/`, with no UI imports,
  so it can move to a backend later. Add unit tests for it.

## Project structure
```
app/                     expo-router routes (thin: only compose feature components)
  _layout.tsx            fonts, providers, web phone frame
  (tabs)/_layout.tsx     bottom navigation
  (tabs)/index.tsx       Home
  (tabs)/field.tsx  (tabs)/scan.tsx  (tabs)/logbook.tsx
  (tabs)/market/_layout.tsx  index.tsx  requests.tsx  offers.tsx  sales.tsx
  market/new.tsx  quality.tsx  alerts.tsx  tasks.tsx  onboarding/index.tsx  onboarding/crop.tsx
src/
  components/ui/         Card, Pill, Button, SectionHeader, AIBox, FieldChips, StatusSteps, Toast, PhoneFrame
  features/<feature>/    screen-specific components (home, field, scan, logbook, market, quality, alerts, onboarding)
  data/mock.ts           seed data
  state/store.ts         zustand store + actions (addSpray, acceptOffer, joinGroup, completeTask …)
  lib/score.ts           quality score + fair price engine (pure TS)
  lib/score.test.ts
  theme/tokens.ts
```

## Layout
- On web with a wide screen (> 500 px), render the app centered inside an iPhone-sized frame (390 x 844)
  on a light blue-grey background. On phones (web or native), full screen, respecting safe areas.
- Bottom tab bar on the 5 main tabs: Home, Field, Scan, Logbook, Market. The active tab shows a black circle
  behind its icon. Detail screens (New listing, Quality score, Alerts, Tasks, Onboarding) have a back button
  and no tab bar.
- Screen transitions must feel instant: no heavy images on first load, lazy-load screens.

## Design tokens
- Background `#FAFAF8`, card `#FFFFFF`, text `#151515`, muted `#6B6B6B`, border `#E6E6E2`, soft grey `#F1EFEA`
- High risk `#C9553A` (soft `#FBE6DE`), medium `#C9A13B` (soft `#F7EED6`), good `#3F6B2F` (soft `#E7F0E2`),
  accent blue `#2E6FB0` (soft `#E8F0F8`)
- Dark cards (AI cards, summaries): `#151515` with green accent `#B9E09A`
- Font: Inter. Headings 800 weight. Cards: 1px border, radius 18–22. Pills/buttons: fully rounded.
- AI content is always marked with a small ✦ sparkle icon.
- Large touch targets (min 44 px) and short, plain English text (users have limited digital experience).

## Design reference
- `screens/*.png` – what each screen must look like.
- `screens/latest/*.png` – newest versions; **these win** over `screens/*.png` with the same number.
- `reference-html/*.html` – static HTML of the older screens. Use only for exact colours, sizes and spacing.
  Rebuild everything as React Native components; never copy HTML.

## Content rules
- All text in English.
- Company names, places and numbers come only from `src/data/mock.ts`.
- Use prices rounded to €0.05 and totals rounded to €50 so screens are easy to read.
- Agronomic facts must be correct: olive fly attacks the fruit; peacock spot shows as round spots on leaves.

## Done means
- Every button listed in `SCREENS.md` works.
- Adding a spray, accepting an offer or completing a task updates all affected screens.
- `npx expo export -p web` builds without errors.
