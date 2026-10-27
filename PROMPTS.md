# Prompts for Claude Code (send one at a time, check the result after each)

1. SETUP + HOME
Read CLAUDE.md and SCREENS.md carefully, and look at every image in screens/ and screens/latest/.
Then:
- Create an Expo + TypeScript project in this folder with expo-router, NativeWind v4, zustand,
  lucide-react-native, react-native-svg and Inter, exactly as described in CLAUDE.md.
- Create the folder structure from CLAUDE.md, the design tokens, the UI components
  (Card, Pill, Button, SectionHeader, AIBox, FieldChips, StatusSteps, Toast, PhoneFrame),
  the tab bar, the mock data and the zustand store.
- Build the Home screen to match screens/latest/01-home.png.
- Make sure it runs on web (`npx expo start --web`) and tell me how to open it on my phone with Expo Go.
Stop after this and wait for my feedback.

2. FIELD, SCAN, LOGBOOK
Build Field (04), Scan result (05) and Logbook (06) from screens/latest. Connect their buttons as in SCREENS.md.
Logbook "Add a spray" opens a modal; saving it adds the spray to the store.

3. MARKET
Build the Market tabs (08 Overview, 10 Requests, 11 Offers, 12 Sales) and New listing (09).
Market sub-tabs must switch instantly. "Accept" moves an offer into Sales; "Offer" on a request opens
New listing prefilled; "Join" shows a toast and marks the group as joined.

4. REST OF THE SCREENS
Build Quality score (07), Alerts (03), This week (02, from screens/), Onboarding step 1 (13, from screens/)
and step 2 (14, from screens/latest). Show the notification messages from 15 as in-app toasts on Home
the first time the app opens.

5. REAL LOGIC
Implement src/lib/score.ts exactly as described in SCREENS.md, with unit tests.
Connect it to the store: adding a spray, completing a task or marking a location risk as done recalculates
the field's score and fair price, and Home, Logbook, Quality score, Market and New listing all update.

6. POLISH
Go through every route and every button in SCREENS.md, compare each screen with its image, and fix any
differences in spacing, colours or text. Check that it looks right on a 390 px wide phone and in the
desktop phone frame. Make transitions fast.

7. PUBLISH
Help me put the code on a new GitHub repository and publish the web version on Vercel
(`npx expo export -p web`, output folder `dist`). Give me the final link.
Then tell me what I would need later to publish it to the App Store and Google Play with EAS.
