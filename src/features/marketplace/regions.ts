/** Canonical marketplace regions (Greece + Türkiye) with locale labels. */

export const MARKET_REGIONS = [
  "Crete",
  "Messinia",
  "Peloponnese",
  "Laconia",
  "Lesvos",
  "Phocis",
  "West Greece",
  "Aydın",
  "Balıkesir",
  "İzmir",
] as const;

export type MarketRegion = (typeof MARKET_REGIONS)[number];

const LABELS: Record<MarketRegion, { en: string; el: string; tr: string }> = {
  Crete: { en: "Crete", el: "Κρήτη", tr: "Girit" },
  Messinia: { en: "Messenia", el: "Μεσσηνία", tr: "Messinya" },
  Peloponnese: { en: "Peloponnese", el: "Πελοπόννησος", tr: "Peloponez" },
  Laconia: { en: "Laconia", el: "Λακωνία", tr: "Lakonya" },
  Lesvos: { en: "Lesvos", el: "Λέσβος", tr: "Midilli" },
  Phocis: { en: "Phocis", el: "Φωκίδα", tr: "Fokida" },
  "West Greece": { en: "West Greece", el: "Δυτική Ελλάδα", tr: "Batı Yunanistan" },
  Aydın: { en: "Aydın", el: "Αϊδίνιο", tr: "Aydın" },
  Balıkesir: { en: "Balıkesir", el: "Μπαλίκεσιρ", tr: "Balıkesir" },
  İzmir: { en: "İzmir", el: "Σμύρνη", tr: "İzmir" },
};

function langOf(locale: string): "en" | "el" | "tr" {
  if (locale.startsWith("el")) return "el";
  if (locale.startsWith("tr")) return "tr";
  return "en";
}

export function resolveMarketRegion(raw: string | null | undefined): MarketRegion | null {
  if (!raw?.trim()) return null;
  const needle = raw.trim().toLowerCase();
  return (
    MARKET_REGIONS.find((p) => {
      const L = LABELS[p];
      return (
        p.toLowerCase() === needle ||
        L.en.toLowerCase() === needle ||
        L.el.toLowerCase() === needle ||
        L.tr.toLowerCase() === needle
      );
    }) ?? null
  );
}

export function regionLabel(raw: string | null | undefined, locale: string): string {
  if (!raw?.trim()) return "—";
  const hit = resolveMarketRegion(raw);
  if (!hit) return raw.trim();
  return LABELS[hit][langOf(locale)];
}

export function regionMatches(lotRegion: string, place: string, selected: string): boolean {
  if (selected === "all") return true;
  const selectedHit = resolveMarketRegion(selected);
  const lotHit = resolveMarketRegion(lotRegion);
  if (selectedHit && lotHit) return selectedHit === lotHit;
  const needle = selected.toLowerCase();
  return lotRegion.toLowerCase() === needle || place.toLowerCase().includes(needle);
}

export function marketRegionOptions(locale: string): { value: string; label: string }[] {
  return MARKET_REGIONS.map((value) => ({ value, label: regionLabel(value, locale) }));
}
