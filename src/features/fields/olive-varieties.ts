/** Canonical olive cultivar catalog (mirrors `public.olive_varieties`). */

export type OliveOriginCountry = "GR" | "TR" | "BOTH";
export type OlivePrimaryUse = "OIL" | "TABLE" | "DUAL";

export type DiseaseKey =
  | "bactrocera_oleae"
  | "spilocaea_oleagina"
  | "colletotrichum"
  | "pseudomonas_savastanoi";

export type DiseaseSusceptibility = Record<DiseaseKey, number>;

export type OliveVariety = {
  slug: string;
  name_en: string;
  name_el: string;
  name_tr: string;
  origin_country: OliveOriginCountry;
  primary_use: OlivePrimaryUse;
  avg_oil_yield_min: number;
  avg_oil_yield_max: number;
  harvest_window_months: number[];
  disease_susceptibility: DiseaseSusceptibility;
  drought_tolerance: number;
  sort_order: number;
};

export const OLIVE_VARIETIES: readonly OliveVariety[] = [
  {
    slug: "koroneiki",
    name_en: "Koroneiki",
    name_el: "Κορωνέικη",
    name_tr: "Koroneiki",
    origin_country: "GR",
    primary_use: "OIL",
    avg_oil_yield_min: 18,
    avg_oil_yield_max: 25,
    harvest_window_months: [10, 11, 12],
    disease_susceptibility: {
      bactrocera_oleae: 4,
      spilocaea_oleagina: 4,
      colletotrichum: 3,
      pseudomonas_savastanoi: 2,
    },
    drought_tolerance: 2,
    sort_order: 10,
  },
  {
    slug: "kalamon",
    name_en: "Kalamon",
    name_el: "Καλαμών",
    name_tr: "Kalamata",
    origin_country: "GR",
    primary_use: "DUAL",
    avg_oil_yield_min: 15,
    avg_oil_yield_max: 18,
    harvest_window_months: [11, 12],
    disease_susceptibility: {
      bactrocera_oleae: 5,
      spilocaea_oleagina: 3,
      colletotrichum: 5,
      pseudomonas_savastanoi: 2,
    },
    drought_tolerance: 3,
    sort_order: 20,
  },
  {
    slug: "athinolia",
    name_en: "Athinolia (Mastoeidis)",
    name_el: "Αθηνολιά / Μαστοειδής",
    name_tr: "Athinolia",
    origin_country: "GR",
    primary_use: "OIL",
    avg_oil_yield_min: 20,
    avg_oil_yield_max: 25,
    harvest_window_months: [10, 11, 12],
    disease_susceptibility: {
      bactrocera_oleae: 3,
      spilocaea_oleagina: 2,
      colletotrichum: 2,
      pseudomonas_savastanoi: 2,
    },
    drought_tolerance: 4,
    sort_order: 30,
  },
  {
    slug: "manaki",
    name_en: "Manaki (Kothreiki)",
    name_el: "Μανάκι / Κοθρέικη",
    name_tr: "Manaki",
    origin_country: "GR",
    primary_use: "OIL",
    avg_oil_yield_min: 18,
    avg_oil_yield_max: 22,
    harvest_window_months: [11, 12],
    disease_susceptibility: {
      bactrocera_oleae: 2,
      spilocaea_oleagina: 2,
      colletotrichum: 2,
      pseudomonas_savastanoi: 1,
    },
    drought_tolerance: 3,
    sort_order: 40,
  },
  {
    slug: "chalkidiki",
    name_en: "Chondrolia Chalkidikis",
    name_el: "Χονδρολιά Χαλκιδικής",
    name_tr: "Halkidiki",
    origin_country: "GR",
    primary_use: "TABLE",
    avg_oil_yield_min: 14,
    avg_oil_yield_max: 17,
    harvest_window_months: [9, 10],
    disease_susceptibility: {
      bactrocera_oleae: 5,
      spilocaea_oleagina: 3,
      colletotrichum: 4,
      pseudomonas_savastanoi: 2,
    },
    drought_tolerance: 2,
    sort_order: 50,
  },
  {
    slug: "konservolia",
    name_en: "Konservolia (Amfissis)",
    name_el: "Κονσερβολιά / Αμφίσσης",
    name_tr: "Konservolia",
    origin_country: "GR",
    primary_use: "TABLE",
    avg_oil_yield_min: 16,
    avg_oil_yield_max: 19,
    harvest_window_months: [9, 10, 11],
    disease_susceptibility: {
      bactrocera_oleae: 5,
      spilocaea_oleagina: 4,
      colletotrichum: 3,
      pseudomonas_savastanoi: 2,
    },
    drought_tolerance: 3,
    sort_order: 60,
  },
  {
    slug: "ayvalik",
    name_en: "Ayvalık",
    name_el: "Αϊβαλί",
    name_tr: "Ayvalık",
    origin_country: "TR",
    primary_use: "OIL",
    avg_oil_yield_min: 20,
    avg_oil_yield_max: 24,
    harvest_window_months: [10, 11, 12],
    disease_susceptibility: {
      bactrocera_oleae: 4,
      spilocaea_oleagina: 3,
      colletotrichum: 3,
      pseudomonas_savastanoi: 2,
    },
    drought_tolerance: 3,
    sort_order: 110,
  },
  {
    slug: "memecik",
    name_en: "Memecik",
    name_el: "Μεμετζίκ",
    name_tr: "Memecik",
    origin_country: "TR",
    primary_use: "OIL",
    avg_oil_yield_min: 18,
    avg_oil_yield_max: 22,
    harvest_window_months: [11, 12],
    disease_susceptibility: {
      bactrocera_oleae: 4,
      spilocaea_oleagina: 3,
      colletotrichum: 3,
      pseudomonas_savastanoi: 2,
    },
    drought_tolerance: 3,
    sort_order: 120,
  },
  {
    slug: "gemlik",
    name_en: "Gemlik",
    name_el: "Γκεμλίκ",
    name_tr: "Gemlik",
    origin_country: "TR",
    primary_use: "DUAL",
    avg_oil_yield_min: 16,
    avg_oil_yield_max: 20,
    harvest_window_months: [10, 11],
    disease_susceptibility: {
      bactrocera_oleae: 4,
      spilocaea_oleagina: 3,
      colletotrichum: 3,
      pseudomonas_savastanoi: 2,
    },
    drought_tolerance: 3,
    sort_order: 130,
  },
  {
    slug: "other",
    name_en: "Other / Local",
    name_el: "Άλλη / Τοπική",
    name_tr: "Diğer / Yerel",
    origin_country: "BOTH",
    primary_use: "DUAL",
    avg_oil_yield_min: 15,
    avg_oil_yield_max: 22,
    harvest_window_months: [10, 11, 12],
    disease_susceptibility: {
      bactrocera_oleae: 3,
      spilocaea_oleagina: 3,
      colletotrichum: 3,
      pseudomonas_savastanoi: 3,
    },
    drought_tolerance: 3,
    sort_order: 900,
  },
] as const;

const BY_SLUG = new Map(OLIVE_VARIETIES.map((v) => [v.slug, v]));

const ALIASES: Record<string, string> = {
  ayvalik: "ayvalik",
  ayvalık: "ayvalik",
  "αϊβαλί": "ayvalik",
  memecik: "memecik",
  gemlik: "gemlik",
  koroneiki: "koroneiki",
  κορωνέικη: "koroneiki",
  kalamon: "kalamon",
  kalamata: "kalamon",
  καλαμών: "kalamon",
  athinolia: "athinolia",
  manaki: "manaki",
  chalkidiki: "chalkidiki",
  halkidiki: "chalkidiki",
  konservolia: "konservolia",
  other: "other",
  άλλη: "other",
  diğer: "other",
  diger: "other",
};

function fold(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function resolveOliveVariety(input: string | null | undefined): OliveVariety | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  const bySlug = BY_SLUG.get(raw.toLowerCase());
  if (bySlug) return bySlug;
  const alias = ALIASES[fold(raw)] ?? ALIASES[raw.toLowerCase()];
  if (alias) return BY_SLUG.get(alias) ?? null;
  return (
    OLIVE_VARIETIES.find(
      (v) =>
        fold(v.name_en) === fold(raw) ||
        fold(v.name_el) === fold(raw) ||
        fold(v.name_tr) === fold(raw),
    ) ?? null
  );
}

export function varietyLabel(v: OliveVariety, locale: string): string {
  if (locale.startsWith("el")) return v.name_el;
  if (locale.startsWith("tr")) return v.name_tr;
  return v.name_en;
}

export function varietyLabelFromStored(stored: string | null | undefined, locale: string): string {
  const v = resolveOliveVariety(stored);
  if (v) return varietyLabel(v, locale);
  return stored?.trim() || "—";
}

/** Aegean mid-line: west → Greece, east → Türkiye. */
export const AEGEAN_SPLIT_LON = 26;

export type OliveCountry = "GR" | "TR";

export type OliveCountryContext = {
  country: OliveCountry;
  /** How the country was inferred (map wins over profile over locale). */
  source: "map" | "profile" | "locale";
};

/**
 * Resolve market country for variety filtering.
 * Priority: field map longitude → profile.country → UI locale.
 */
export function resolveOliveCountry(opts: {
  locale: string;
  lon?: number | null;
  profileCountry?: OliveCountry | null;
}): OliveCountryContext {
  if (opts.lon != null && Number.isFinite(opts.lon)) {
    return { country: opts.lon < AEGEAN_SPLIT_LON ? "GR" : "TR", source: "map" };
  }
  if (opts.profileCountry === "GR" || opts.profileCountry === "TR") {
    return { country: opts.profileCountry, source: "profile" };
  }
  if (opts.locale.startsWith("tr")) return { country: "TR", source: "locale" };
  return { country: "GR", source: "locale" };
}

/** @deprecated Use resolveOliveCountry — kept for call sites that only need GR|TR. */
export function preferredOrigin(
  locale: string,
  lon?: number | null,
  profileCountry?: OliveCountry | null,
): OliveCountry {
  return resolveOliveCountry({ locale, lon, profileCountry }).country;
}

export function defaultVarietySlug(country: OliveCountry): string {
  return country === "TR" ? "ayvalik" : "koroneiki";
}

/** Local cultivars for one country + shared «Other / Local». */
export function varietiesForCountry(country: OliveCountry): OliveVariety[] {
  return OLIVE_VARIETIES.filter(
    (v) => v.origin_country === country || v.origin_country === "BOTH",
  ).sort((a, b) => a.sort_order - b.sort_order);
}

export function isVarietyAllowed(slug: string, country: OliveCountry): boolean {
  const v = BY_SLUG.get(slug);
  if (!v) return false;
  return v.origin_country === country || v.origin_country === "BOTH";
}

/** Single country group + optional «Other» — never shows the other country's list. */
export function varietiesGrouped(
  locale: string,
  lon?: number | null,
  profileCountry?: OliveCountry | null,
): { origin: OliveOriginCountry; labelKey: "groupGreece" | "groupTurkey" | "groupOther"; items: OliveVariety[] }[] {
  const { country } = resolveOliveCountry({ locale, lon, profileCountry });
  const local = OLIVE_VARIETIES.filter((v) => v.origin_country === country);
  const both = OLIVE_VARIETIES.filter((v) => v.origin_country === "BOTH");
  return [
    {
      origin: country,
      labelKey: country === "TR" ? "groupTurkey" : "groupGreece",
      items: local,
    },
    { origin: "BOTH", labelKey: "groupOther", items: both },
  ];
}

/** Compact agronomic context for AI / risk prompts. */
export function varietyAgronomyContext(stored: string | null | undefined) {
  const v = resolveOliveVariety(stored);
  if (!v) return null;
  return {
    slug: v.slug,
    name_en: v.name_en,
    primary_use: v.primary_use,
    origin_country: v.origin_country,
    avg_oil_yield_pct: [v.avg_oil_yield_min, v.avg_oil_yield_max] as [number, number],
    harvest_window_months: v.harvest_window_months,
    drought_tolerance_1to5: v.drought_tolerance,
    disease_susceptibility_1to5: v.disease_susceptibility,
  };
}

/** Map catalog disease keys → risk engine threat ids. */
export const DISEASE_TO_THREAT = {
  bactrocera_oleae: "olive-fly",
  spilocaea_oleagina: "peacock-spot",
  colletotrichum: "anthracnose",
  pseudomonas_savastanoi: "olive-knot",
} as const;

/** Soft multiplier 0.85–1.2 from susceptibility 1–5 (3 = baseline). */
export function susceptibilityRiskFactor(score1to5: number): number {
  const s = Math.max(1, Math.min(5, score1to5));
  return 0.85 + (s - 1) * 0.0875;
}

/** Soft multiplier for drought: low tolerance (1) raises drought risk. */
export function droughtRiskFactor(tolerance1to5: number): number {
  const t = Math.max(1, Math.min(5, tolerance1to5));
  return 1.2 - (t - 1) * 0.0875;
}

export function marketplaceVarietyOptions(
  locale: string,
  opts?: { lon?: number | null; profileCountry?: OliveCountry | null; includeOther?: boolean },
) {
  const { country } = resolveOliveCountry({
    locale,
    lon: opts?.lon,
    profileCountry: opts?.profileCountry,
  });
  const includeOther = opts?.includeOther ?? false;
  return varietiesForCountry(country)
    .filter((v) => includeOther || v.slug !== "other")
    .map((v) => ({
      value: v.slug,
      label: varietyLabel(v, locale),
      primary_use: v.primary_use,
      origin_country: v.origin_country,
      avg_oil_yield_min: v.avg_oil_yield_min,
      avg_oil_yield_max: v.avg_oil_yield_max,
    }));
}
