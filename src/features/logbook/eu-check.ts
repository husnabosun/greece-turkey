/**
 * Checks active substances AND the product (trade) name against substances that are NOT approved in the EU.
 * Demo data: it is not the legal register. Before a real launch, replace it with the EU Pesticides Database
 * (https://ec.europa.eu/food/plant/pesticides/eu-pesticides-database) or the national register of Türkiye / Greece.
 *
 * Matching works on a phonetic "consonant skeleton" so Greek (χλωρπυριφός, χλωροπυριφός), Turkish (klorpirifos)
 * and English (chlorpyrifos) spellings all meet. Anything we do not recognise is "unknown", never "allowed".
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

type Banned = (typeof EU_NOT_APPROVED)[number];

/** Extra spellings and trade names (EN / EL / TR) for each banned substance. */
const BANNED_ALIASES: Record<Banned, string[]> = {
  chlorpyrifos: ["chlorpyrifos", "chlorpyrifos-methyl", "χλωρπυριφός", "χλωροπυριφός", "χλωρπυριφος μεθυλ", "klorpirifos", "klorprifos", "dursban", "lorsban", "pyrinex", "reldan", "nurelle"],
  dimethoate: ["dimethoate", "ντιμεθοέιτ", "διμεθοάτ", "διμεθοέιτ", "ντιμεθοάτ", "dimetoat", "rogor", "perfekthion", "danadim", "danadin"],
  fenthion: ["fenthion", "φενθείον", "φενθειόν", "fention", "lebaycid", "λεμπαϋσίντ"],
  carbendazim: ["carbendazim", "καρμπενδαζίμ", "karbendazim", "bavistin", "derosal"],
  paraquat: ["paraquat", "παρακουάτ", "parakuat", "gramoxone", "γκραμοξόν"],
  mancozeb: ["mancozeb", "μανκοζέμπ", "mankozeb", "dithane", "manzate", "penncozeb"],
  imidacloprid: ["imidacloprid", "ιμιδακλοπρίδ", "ιμιδακλοπρίντ", "imidakloprid", "confidor", "κονφιντόρ", "gaucho"],
  thiamethoxam: ["thiamethoxam", "θειαμεθοξάμ", "θιαμεθοξάμ", "tiametoksam", "actara", "ακτάρα", "cruiser"],
  clothianidin: ["clothianidin", "κλοθιανιδίνη", "klotianidin", "dantop", "poncho"],
  malathion: ["malathion", "μαλαθείο", "μαλαθείον", "malatyon", "fyfanon"],
  diazinon: ["diazinon", "διαζινόν", "diazinon", "basudin"],
  endosulfan: ["endosulfan", "ενδοσουλφάν", "thionex", "thiodan"],
  methidathion: ["methidathion", "μεθιδαθείον", "metidatyon", "ultracide"],
  phosmet: ["phosmet", "φωσμέτ", "fosmet", "imidan"],
};

/** Approved actives (and common products) for olives we recognise as "allowed". */
const KNOWN_OK: string[] = [
  "copper", "copper oxychloride", "copper hydroxide", "χαλκός", "οξυχλωριούχος χαλκός", "υδροξείδιο του χαλκού", "bakır", "bordeaux", "βορδιγάλειος", "bordo bulamacı",
  "kaolin", "καολίνης", "surround", "spinosad", "σπινοζάντ", "spintor", "deltamethrin", "δελταμεθρίνη", "deltametrin", "decis",
  "lambda-cyhalothrin", "λάμδα-σιαλοθρίνη", "karate", "acetamiprid", "ακεταμιπρίντ", "mospilan", "epik",
  "pyrethrins", "πυρεθρίνες", "piretrin", "bacillus thuringiensis", "bt", "paraffin oil", "mineral oil", "παραφινικό λάδι", "θερινός πολτός",
  "sulfur", "sulphur", "θείο", "kükürt", "fosetyl", "φοσετύλ", "tebuconazole", "τεμπουκοναζόλ", "difenoconazole", "διφενοκοναζόλ",
  "trifloxystrobin", "azoxystrobin", "αζοξυστρομπίνη", "dodine", "ντοντίν", "glyphosate", "γλυφοσάτη", "pyriproxyfen", "πυριπροξυφέν",
];

export type EuStatus = "banned" | "allowed" | "unknown";

export interface EuCheck {
  /** True when at least one substance or the product name is on the banned list. */
  banned: boolean;
  /** The banned substances that matched (canonical names). */
  hits: string[];
  /** banned · allowed (every substance recognised as approved) · unknown (anything else). */
  status: EuStatus;
}

const LETTERS: Record<string, string> = {
  α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i", θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "ks", ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y",
  ΰ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o", ı: "i", ğ: "g", ü: "u", ş: "s", ö: "o", ç: "c", â: "a", î: "i", û: "u",
};

function latinize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFC")
    .split("")
    .map((ch) => LETTERS[ch] ?? ch)
    .join("");
}

/** Phonetic consonant skeleton: "χλωρπυριφός" / "chlorpyrifos" / "klorpirifos" → "klrprfs". */
export function skeleton(raw: string): string {
  let s = latinize(raw).replace(/[^a-z]/g, "");
  s = s
    .replace(/^nt/, "d")
    .replace(/mp/g, "b")
    .replace(/nt/g, "nd")
    .replace(/ch|kh|q|c/g, "k")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/x/g, "ks")
    .replace(/w/g, "v");
  s = s.replace(/[aeiouy]/g, "");
  return s.replace(/(.)\1+/g, "$1");
}

/** Words + the whole phrase; numbers, units and doses are ignored. */
function tokens(raw: string): string[] {
  const words = latinize(raw)
    .split(/[^a-z\u0370-\u03ff]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
  const out = new Set<string>();
  for (const w of words) out.add(skeleton(w));
  for (let i = 0; i + 1 < words.length; i++) out.add(skeleton(words[i] + words[i + 1]));
  out.add(skeleton(raw));
  return [...out].filter(Boolean);
}

function matches(tokenSkel: string, aliasSkel: string): boolean {
  if (!tokenSkel || !aliasSkel) return false;
  if (tokenSkel === aliasSkel) return true;
  // Substring match only for long, distinctive skeletons ("klrprfsmtl" contains "klrprfs").
  return aliasSkel.length >= 5 && tokenSkel.length >= aliasSkel.length && tokenSkel.includes(aliasSkel);
}

const BANNED_SKELETONS: [Banned, string][] = (Object.keys(BANNED_ALIASES) as Banned[]).flatMap((k) =>
  BANNED_ALIASES[k].map((a) => [k, skeleton(a)] as [Banned, string]),
);
const OK_SKELETONS = KNOWN_OK.map((a) => skeleton(a)).filter((s) => s.length >= 2);

function bannedIn(raw: string): Banned | null {
  const toks = tokens(raw);
  for (const [canonical, sk] of BANNED_SKELETONS) {
    if (toks.some((t) => matches(t, sk))) return canonical;
  }
  return null;
}

function knownOk(raw: string): boolean {
  const toks = tokens(raw);
  return OK_SKELETONS.some((sk) => toks.some((t) => t === sk || (sk.length >= 5 && t.includes(sk))));
}

/**
 * @param activeSubstances what the farmer typed as active substances
 * @param productName optional trade name (e.g. "Dursban") — checked for banned products too
 */
export function euCheck(activeSubstances: string[], productName?: string | null): EuCheck {
  const hits = new Set<string>();
  const subs = activeSubstances.map((s) => s.trim()).filter(Boolean);

  for (const s of subs) {
    const b = bannedIn(s);
    if (b) hits.add(b);
  }
  if (productName?.trim()) {
    const b = bannedIn(productName);
    if (b) hits.add(b);
  }
  if (hits.size > 0) return { banned: true, hits: [...hits], status: "banned" };

  // Allowed only when there is at least one substance and every one is recognised as approved.
  if (subs.length > 0 && subs.every((s) => knownOk(s))) {
    return { banned: false, hits: [], status: "allowed" };
  }
  if (subs.length === 0 && productName?.trim() && knownOk(productName)) {
    return { banned: false, hits: [], status: "allowed" };
  }
  return { banned: false, hits: [], status: "unknown" };
}
