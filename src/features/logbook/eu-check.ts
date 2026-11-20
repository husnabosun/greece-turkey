/**
 * Checks active substances against a short list of substances that are NOT approved in the EU.
 * Demo data: it is not the legal register. Before a real launch, replace it with the EU Pesticides Database
 * (https://ec.europa.eu/food/plant/pesticides/eu-pesticides-database) or the national register of Türkiye / Greece.
 */
export const EU_NOT_APPROVED = [
  "chlorpyrifos", // includes chlorpyrifos-methyl; not approved since 2020
  "dimethoate", // olive fly spray, withdrawn 2019
  "fenthion", // olive fly bait spray, not approved since 2015
  "carbendazim",
  "paraquat",
  "mancozeb", // not renewed 2021
  "imidacloprid", // outdoor use banned 2018
  "thiamethoxam", // outdoor use banned 2018
  "clothianidin", // outdoor use banned 2018
  "malathion",
  "diazinon",
  "endosulfan",
  "methidathion",
  "phosmet", // not renewed 2022
] as const;

/** Synonyms / trade names / EL / TR spellings → canonical banned slug. */
const SYNONYMS: Record<string, (typeof EU_NOT_APPROVED)[number]> = {
  chlorpyrifos: "chlorpyrifos",
  chlorpyrifosmethyl: "chlorpyrifos",
  dursban: "chlorpyrifos",
  lorsban: "chlorpyrifos",
  // Greek phonetic / common spellings (latinized after strip)
  xloropyrifos: "chlorpyrifos",
  xloropyrifws: "chlorpyrifos",
  xlwropyrafos: "chlorpyrifos",
  xloropirifos: "chlorpyrifos",
  chloropyrifos: "chlorpyrifos",
  klorpirifos: "chlorpyrifos",
  klorpirifosmetil: "chlorpyrifos",
  // dimethoate
  dimethoate: "dimethoate",
  dimetoat: "dimethoate",
  dimethoat: "dimethoate",
  dimethoatum: "dimethoate",
  // fenthion
  fenthion: "fenthion",
  lebacyid: "fenthion",
  // others
  carbendazim: "carbendazim",
  paraquat: "paraquat",
  mancozeb: "mancozeb",
  imidacloprid: "imidacloprid",
  thiamethoxam: "thiamethoxam",
  clothianidin: "clothianidin",
  malathion: "malathion",
  diazinon: "diazinon",
  endosulfan: "endosulfan",
  methidathion: "methidathion",
  phosmet: "phosmet",
};

/** Well-known olive-safe actives we treat as recognized (not "unknown"). */
const KNOWN_OK = [
  "copper",
  "copperoxychloride",
  "bordeaux",
  "kaolin",
  "spinosad",
  "deltamethrin",
  "pyrethrin",
  "bacillusthuringiensis",
  "bt",
  "mineraloil",
  "paraffinoil",
  "sulfur",
  "sulphur",
];

export type EuStatus = "banned" | "allowed" | "unknown";

export interface EuCheck {
  /** True when at least one substance is on the banned list. */
  banned: boolean;
  /** The substances that matched (from the list). */
  hits: string[];
  /** Overall status — unknown when nothing matched a known list. */
  status: EuStatus;
}

/** Latinize Greek/Turkish letters so synonym matching works on typed names. */
function latinize(s: string): string {
  const map: Record<string, string> = {
    α: "a",
    ά: "a",
    β: "b",
    γ: "g",
    δ: "d",
    ε: "e",
    έ: "e",
    ζ: "z",
    η: "i",
    ή: "i",
    θ: "th",
    ι: "i",
    ί: "i",
    ϊ: "i",
    ΐ: "i",
    κ: "k",
    λ: "l",
    μ: "m",
    ν: "n",
    ξ: "x",
    ο: "o",
    ό: "o",
    π: "p",
    ρ: "r",
    σ: "s",
    ς: "s",
    τ: "t",
    υ: "y",
    ύ: "y",
    ϋ: "y",
    ΰ: "y",
    φ: "f",
    χ: "x",
    ψ: "ps",
    ω: "o",
    ώ: "o",
    ı: "i",
    ğ: "g",
    ü: "u",
    ş: "s",
    ö: "o",
    ç: "c",
  };
  return s
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
}

const norm = (s: string) => latinize(s).replace(/[^a-z0-9]/g, "");

function matchBanned(normalized: string): (typeof EU_NOT_APPROVED)[number] | null {
  for (const [syn, canonical] of Object.entries(SYNONYMS)) {
    if (normalized.includes(syn)) return canonical;
  }
  for (const banned of EU_NOT_APPROVED) {
    if (normalized.includes(norm(banned))) return banned;
  }
  return null;
}

function isKnownOk(normalized: string): boolean {
  return KNOWN_OK.some((k) => normalized.includes(k) || k.includes(normalized));
}

export function euCheck(activeSubstances: string[]): EuCheck {
  const hits = new Set<string>();
  let anyRecognized = false;

  for (const s of activeSubstances) {
    const n = norm(s);
    if (!n) continue;
    const banned = matchBanned(n);
    if (banned) {
      hits.add(banned);
      anyRecognized = true;
      continue;
    }
    if (isKnownOk(n)) anyRecognized = true;
  }

  if (hits.size > 0) {
    return { banned: true, hits: [...hits], status: "banned" };
  }
  if (activeSubstances.some((s) => norm(s)) && !anyRecognized) {
    return { banned: false, hits: [], status: "unknown" };
  }
  return { banned: false, hits: [], status: "allowed" };
}
