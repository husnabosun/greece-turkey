/** Marketplace regions = geographic districts (γεωγραφικά διαμερίσματα / coğrafi bölgeler). */

export const MARKET_REGIONS = [
  "Thrace",
  "Macedonia",
  "Epirus",
  "Thessaly",
  "Central Greece",
  "Peloponnese",
  "Ionian Islands",
  "Aegean Islands",
  "Crete",
  "Marmara",
  "Aegean Turkey",
  "Mediterranean Turkey",
  "Black Sea",
  "Central Anatolia",
  "Eastern Anatolia",
  "Southeastern Anatolia",
] as const;

export type MarketRegion = (typeof MARKET_REGIONS)[number];

const LABELS: Record<MarketRegion, { en: string; el: string; tr: string }> = {
  Thrace: { en: "Thrace", el: "Θράκη", tr: "Trakya" },
  Macedonia: { en: "Macedonia", el: "Μακεδονία", tr: "Makedonya" },
  Epirus: { en: "Epirus", el: "Ήπειρος", tr: "Epir" },
  Thessaly: { en: "Thessaly", el: "Θεσσαλία", tr: "Tesalya" },
  "Central Greece": { en: "Central Greece", el: "Στερεά Ελλάδα", tr: "Orta Yunanistan" },
  Peloponnese: { en: "Peloponnese", el: "Πελοπόννησος", tr: "Peloponez" },
  "Ionian Islands": { en: "Ionian Islands", el: "Ιόνια Νησιά", tr: "İyon Adaları" },
  "Aegean Islands": { en: "Aegean Islands", el: "Νησιά Αιγαίου", tr: "Ege Adaları" },
  Crete: { en: "Crete", el: "Κρήτη", tr: "Girit" },
  Marmara: { en: "Marmara", el: "Μαρμαράς", tr: "Marmara" },
  "Aegean Turkey": { en: "Aegean (Türkiye)", el: "Αιγαίο (Τουρκία)", tr: "Ege" },
  "Mediterranean Turkey": { en: "Mediterranean (Türkiye)", el: "Μεσόγειος (Τουρκία)", tr: "Akdeniz" },
  "Black Sea": { en: "Black Sea", el: "Μαύρη Θάλασσα", tr: "Karadeniz" },
  "Central Anatolia": { en: "Central Anatolia", el: "Κεντρική Ανατολία", tr: "İç Anadolu" },
  "Eastern Anatolia": { en: "Eastern Anatolia", el: "Ανατολική Ανατολία", tr: "Doğu Anadolu" },
  "Southeastern Anatolia": { en: "Southeastern Anatolia", el: "ΝΑ Ανατολία", tr: "Güneydoğu Anadolu" },
};

/** Approximate olive-belt centre [lon, lat] for map markers. */
export const REGION_CENTERS: Record<MarketRegion, [number, number]> = {
  Thrace: [26.5, 41.15],
  Macedonia: [22.95, 40.65],
  Epirus: [20.85, 39.65],
  Thessaly: [22.4, 39.55],
  "Central Greece": [22.4, 38.55],
  Peloponnese: [22.4, 37.55],
  "Ionian Islands": [20.5, 38.5],
  "Aegean Islands": [26.3, 39.1],
  Crete: [24.9, 35.24],
  Marmara: [27.5, 40.2],
  "Aegean Turkey": [27.4, 38.2],
  "Mediterranean Turkey": [31.0, 36.8],
  "Black Sea": [36.3, 41.0],
  "Central Anatolia": [32.85, 39.0],
  "Eastern Anatolia": [41.3, 39.9],
  "Southeastern Anatolia": [39.2, 37.2],
};

/**
 * Legacy prefecture / city / province strings → geographic district.
 * Keeps older lots & requests filterable after the region list change.
 */
const ALIASES: Record<string, MarketRegion> = {
  // Greece — prefectures / places → διαμέρισμα
  messinia: "Peloponnese",
  messenia: "Peloponnese",
  μεσσηνία: "Peloponnese",
  laconia: "Peloponnese",
  lakonia: "Peloponnese",
  λακωνία: "Peloponnese",
  argolis: "Peloponnese",
  achaea: "Peloponnese",
  achaia: "Peloponnese",
  elis: "Peloponnese",
  ilia: "Peloponnese",
  arcadia: "Peloponnese",
  corinth: "Peloponnese",
  corinthia: "Peloponnese",
  kalamata: "Peloponnese",
  pylos: "Peloponnese",
  phocis: "Central Greece",
  fokida: "Central Greece",
  φωκίδα: "Central Greece",
  "west greece": "Central Greece",
  "δυτική ελλάδα": "Central Greece",
  aetolia: "Central Greece",
  etoloakarnania: "Central Greece",
  boeotia: "Central Greece",
  euboea: "Central Greece",
  evia: "Central Greece",
  attica: "Central Greece",
  αττική: "Central Greece",
  "north aegean": "Aegean Islands",
  "βόρειο αιγαίο": "Aegean Islands",
  "περιφέρεια βορείου αιγαίου": "Aegean Islands",
  "kuzey ege": "Aegean Islands",
  "south aegean": "Aegean Islands",
  "νότιο αιγαίο": "Aegean Islands",
  mytilene: "Aegean Islands",
  μυτιλήνη: "Aegean Islands",
  "north aegean region": "Aegean Islands",
  peloponnese: "Peloponnese",
  "peloponnese region": "Peloponnese",
  "περιφέρεια πελοποννήσου": "Peloponnese",
  "western greece": "Central Greece",
  "central macedonia": "Macedonia",
  "κεντρική μακεδονία": "Macedonia",
  "eastern macedonia and thrace": "Thrace",
  "ανατολική μακεδονία και θράκη": "Thrace",
  lesvos: "Aegean Islands",
  lesbos: "Aegean Islands",
  λέσβος: "Aegean Islands",
  midilli: "Aegean Islands",
  chios: "Aegean Islands",
  samos: "Aegean Islands",
  cyclades: "Aegean Islands",
  dodecanese: "Aegean Islands",
  rhodes: "Aegean Islands",
  corfu: "Ionian Islands",
  kerkyra: "Ionian Islands",
  zakynthos: "Ionian Islands",
  kefalonia: "Ionian Islands",
  heraklion: "Crete",
  chania: "Crete",
  rethymno: "Crete",
  lasithi: "Crete",
  // Türkiye — iller → coğrafi bölge
  aydın: "Aegean Turkey",
  aydin: "Aegean Turkey",
  αϊδίνιο: "Aegean Turkey",
  izmir: "Aegean Turkey",
  i̇zmir: "Aegean Turkey",
  σμύρνη: "Aegean Turkey",
  manisa: "Aegean Turkey",
  mugla: "Aegean Turkey",
  muğla: "Aegean Turkey",
  balıkesir: "Marmara",
  balikesir: "Marmara",
  μπαλίκεσιρ: "Marmara",
  bursa: "Marmara",
  canakkale: "Marmara",
  çanakkale: "Marmara",
  antalya: "Mediterranean Turkey",
  mersin: "Mediterranean Turkey",
  hatay: "Mediterranean Turkey",
  adana: "Mediterranean Turkey",
  trabzon: "Black Sea",
  rize: "Black Sea",
  samsun: "Black Sea",
  ordu: "Black Sea",
  ankara: "Central Anatolia",
  konya: "Central Anatolia",
  kayseri: "Central Anatolia",
  nevsehir: "Central Anatolia",
  nevşehir: "Central Anatolia",
  erzurum: "Eastern Anatolia",
  van: "Eastern Anatolia",
  malatya: "Eastern Anatolia",
  elazig: "Eastern Anatolia",
  elazığ: "Eastern Anatolia",
  gaziantep: "Southeastern Anatolia",
  sanliurfa: "Southeastern Anatolia",
  şanlıurfa: "Southeastern Anatolia",
  diyarbakir: "Southeastern Anatolia",
  diyarbakır: "Southeastern Anatolia",
  mardin: "Southeastern Anatolia",
  // Turkish region names themselves
  ege: "Aegean Turkey",
  akdeniz: "Mediterranean Turkey",
  karadeniz: "Black Sea",
  "iç anadolu": "Central Anatolia",
  "ic anadolu": "Central Anatolia",
  "doğu anadolu": "Eastern Anatolia",
  "dogu anadolu": "Eastern Anatolia",
  "güneydoğu anadolu": "Southeastern Anatolia",
  "guneydogu anadolu": "Southeastern Anatolia",
};

function langOf(locale: string): "en" | "el" | "tr" {
  if (locale.startsWith("el")) return "el";
  if (locale.startsWith("tr")) return "tr";
  return "en";
}

function fold(s: string) {
  return s.trim().toLowerCase();
}

export function resolveMarketRegion(raw: string | null | undefined): MarketRegion | null {
  if (!raw?.trim()) return null;
  const needle = fold(raw);

  const direct = MARKET_REGIONS.find((p) => {
    const L = LABELS[p];
    return (
      fold(p) === needle ||
      fold(L.en) === needle ||
      fold(L.el) === needle ||
      fold(L.tr) === needle
    );
  });
  if (direct) return direct;

  if (ALIASES[needle]) return ALIASES[needle];

  // "Nazilli, Aydın" / "Kalamata, Messinia" → last segment
  const parts = raw.split(",").map((p) => fold(p)).filter(Boolean);
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1]!;
    if (ALIASES[tail]) return ALIASES[tail];
    const byTail = MARKET_REGIONS.find((p) => {
      const L = LABELS[p];
      return fold(p) === tail || fold(L.en) === tail || fold(L.el) === tail || fold(L.tr) === tail;
    });
    if (byTail) return byTail;
  }

  return null;
}

export function regionLabel(raw: string | null | undefined, locale: string): string {
  if (!raw?.trim()) return "—";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    const resolved = parts.map((p) => resolveMarketRegion(p));
    if (resolved.every((r): r is MarketRegion => r != null)) {
      return resolved.map((r) => LABELS[r][langOf(locale)]).join(" · ");
    }
  }
  const hit = resolveMarketRegion(raw);
  if (!hit) return raw.trim();
  return LABELS[hit][langOf(locale)];
}

export function regionMatches(lotRegion: string, place: string, selected: string): boolean {
  if (selected === "all") return true;
  const selectedHit = resolveMarketRegion(selected);
  const lotHit = resolveMarketRegion(lotRegion) ?? resolveMarketRegion(place);
  if (selectedHit && lotHit) return selectedHit === lotHit;
  const needle = selected.toLowerCase();
  return lotRegion.toLowerCase() === needle || place.toLowerCase().includes(needle);
}

export function marketRegionOptions(locale: string): { value: string; label: string }[] {
  return MARKET_REGIONS.map((value) => ({ value, label: regionLabel(value, locale) }));
}

const GR_REGIONS: MarketRegion[] = [
  "Thrace",
  "Macedonia",
  "Epirus",
  "Thessaly",
  "Central Greece",
  "Peloponnese",
  "Ionian Islands",
  "Aegean Islands",
  "Crete",
];

/** Nearest market region for a field point, restricted to the farmer's country when known. */
export function regionForPoint(
  lat: number | null | undefined,
  lon: number | null | undefined,
  country: "GR" | "TR" | null | undefined,
): MarketRegion | null {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const pool = MARKET_REGIONS.filter((r) =>
    country === "GR" ? GR_REGIONS.includes(r) : country === "TR" ? !GR_REGIONS.includes(r) : true,
  );
  let best: MarketRegion | null = null;
  let bestD = Infinity;
  for (const r of pool) {
    const [clon, clat] = REGION_CENTERS[r];
    const dx = (lon - clon) * Math.cos((lat * Math.PI) / 180);
    const d = dx * dx + (lat - clat) * (lat - clat);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

/** Resolved regions of a (possibly comma-separated) request region. Empty = anywhere. */
export function requestRegions(raw: string | null | undefined): MarketRegion[] {
  if (!raw?.trim()) return [];
  const whole = resolveMarketRegion(raw);
  if (whole) return [whole];
  return [
    ...new Set(
      raw
        .split(/[,·]/)
        .map((p) => resolveMarketRegion(p))
        .filter((r): r is MarketRegion => r != null),
    ),
  ];
}
