const CHEMICAL_WORDS = [
  "copper",
  "bordeaux",
  "mancozeb",
  "dodine",
  "kresoxim",
  "tebuconazole",
  "difenoconazole",
  "azoxystrobin",
  "dimethoate",
  "chlorpyrifos",
  "fenthion",
  "deltamethrin",
  "lambda-cyhalothrin",
  "cypermethrin",
  "spinosad",
  "spinetoram",
  "imidacloprid",
  "acetamiprid",
  "phosmet",
  "malathion",
  "fungicide",
  "insecticide",
  "pesticide",
  "herbicide",
  "fungisit",
  "insektisit",
  "pestisit",
  "bakır",
  "μυκητοκτόν",
  "εντομοκτόν",
  "φυτοφάρμακ",
  "χαλκ",
];

const DOSE =
  /\b\d+([.,]\d+)?\s*(kg|g|l|lt|ml|litre|liter|λίτρ\w*|γραμ\w*)\s*(\/|per|ανά|başına)\s*(ha|hectare|100\s*l|dekar|στρέμμα)/i;

export function containsChemicalAdvice(text: string): boolean {
  const t = text.toLowerCase();
  return CHEMICAL_WORDS.some((w) => t.includes(w)) || DOSE.test(t);
}

export function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

export function numbersIn(text: string): number[] {
  return (text.match(/\d+([.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));
}

export function sentenceCount(text: string): number {
  return text.split(/[.!?;]+(?:\s|$)/).filter((s) => s.trim().length > 0).length;
}

/** Reject advisor text that invents chemicals, long essays, or numbers not in the allowed set. */
export function isAdviceSafe(advice: { summary: string; actions: string[]; whyNow: string }, allowedNumbers: number[]): boolean {
  const texts = [advice.summary, advice.whyNow, ...advice.actions];
  if (texts.some(containsChemicalAdvice)) return false;
  if (sentenceCount(advice.summary) > 2) return false;
  const allowed = new Set(allowedNumbers.map((n) => Math.round(n * 100) / 100));
  for (const text of texts) {
    for (const n of numbersIn(text)) {
      const rounded = Math.round(n * 100) / 100;
      if (![...allowed].some((a) => Math.abs(a - rounded) < 0.011)) return false;
    }
  }
  return true;
}
