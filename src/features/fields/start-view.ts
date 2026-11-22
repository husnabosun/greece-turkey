/**
 * Where a map should open when it has nothing of the user's own to frame.
 * Order: the user's fields, their last map position, their profile region, then the app language.
 * Pure (no UI / IO) so it can be tested.
 */
import type { LngLatBoundsTuple } from "@/features/fields/map-fit";

export type StartViewSource = "fields" | "saved" | "profile" | "locale";

export type StartView = {
  center: [number, number];
  zoom: number;
  /** Set when the view should frame an area (the user's fields) instead of a fixed zoom. */
  bounds?: LngLatBoundsTuple;
  source: StartViewSource;
};

export type OnboardingRegion = {
  id: string;
  el: string;
  en: string;
  tr: string;
  /** [lon, lat] of the olive area, and the zoom that shows it. */
  center: [number, number];
  zoom: number;
};

/** Regions offered in onboarding (also what `profiles.place` holds, in the language chosen at the time). */
export const REGIONS_GR: readonly OnboardingRegion[] = [
  { id: "north-aegean", el: "Βόρειο Αιγαίο", en: "North Aegean", tr: "Kuzey Ege", center: [26.3, 39.15], zoom: 9.2 },
  { id: "crete", el: "Κρήτη", en: "Crete", tr: "Girit", center: [24.9, 35.24], zoom: 8.6 },
  { id: "peloponnese", el: "Πελοπόννησος", en: "Peloponnese", tr: "Mora", center: [22.4, 37.55], zoom: 8.4 },
  { id: "central-greece", el: "Στερεά Ελλάδα", en: "Central Greece", tr: "Orta Yunanistan", center: [22.4, 38.55], zoom: 8.4 },
];

export const REGIONS_TR: readonly OnboardingRegion[] = [
  { id: "izmir", el: "Σμύρνη", en: "İzmir", tr: "İzmir", center: [27.14, 38.42], zoom: 9.2 },
  { id: "aydin", el: "Αϊδίνιο", en: "Aydın", tr: "Aydın", center: [27.84, 37.85], zoom: 9.2 },
  { id: "mugla", el: "Μούγλα", en: "Muğla", tr: "Muğla", center: [28.36, 37.21], zoom: 8.8 },
  { id: "balikesir", el: "Μπαλικεσίρ", en: "Balıkesir", tr: "Balıkesir", center: [27.5, 39.5], zoom: 8.5 },
];

/** Edremit Gulf / Ayvalık (TR), Lesvos (EL), and the strait between them (EN, shows both). */
export const LOCALE_START_VIEW: Record<"tr" | "el" | "en", { center: [number, number]; zoom: number }> = {
  tr: { center: [26.7, 39.3], zoom: 9.5 },
  el: { center: [26.3, 39.15], zoom: 9.5 },
  en: { center: [26.5, 39.22], zoom: 8.8 },
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** View for a `profiles.place` value ("North Aegean", "Βόρειο Αιγαίο", "İzmir" ...), or null when unknown. */
export function viewForProfilePlace(place: string | null | undefined): Omit<StartView, "source"> | null {
  if (!place || !place.trim()) return null;
  const needle = fold(place);
  const hit = [...REGIONS_GR, ...REGIONS_TR].find((r) => [r.en, r.el, r.tr, r.id].some((label) => fold(label) === needle));
  return hit ? { center: hit.center, zoom: hit.zoom } : null;
}

export function viewForLocale(locale: string): Omit<StartView, "source"> {
  const key = locale.startsWith("tr") ? "tr" : locale.startsWith("el") ? "el" : "en";
  return LOCALE_START_VIEW[key];
}

function boundsCenter(b: LngLatBoundsTuple): [number, number] {
  return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
}

export function resolveStartView(input: {
  /** Bounds of the user's fields (see fitBoundsFor), null when they have none or none can be placed. */
  fieldBounds: LngLatBoundsTuple | null;
  /** Last position the user picked on a map (device location), if any. */
  saved: { center: [number, number]; zoom: number } | null;
  /** `profiles.place`. */
  profilePlace: string | null | undefined;
  locale: string;
}): StartView {
  if (input.fieldBounds) {
    return { center: boundsCenter(input.fieldBounds), zoom: 14, bounds: input.fieldBounds, source: "fields" };
  }
  if (input.saved) return { ...input.saved, source: "saved" };
  const region = viewForProfilePlace(input.profilePlace);
  if (region) return { ...region, source: "profile" };
  return { ...viewForLocale(input.locale), source: "locale" };
}
