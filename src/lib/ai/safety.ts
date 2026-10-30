/** Last line of defence: the model is told never to recommend chemicals, and we check its text anyway. */

/** Active substances and product words we never want in advice text (a short list, not complete). */
const CHEMICAL_WORDS = [
  'copper', 'bordeaux', 'mancozeb', 'dodine', 'kresoxim', 'tebuconazole', 'difenoconazole', 'azoxystrobin',
  'dimethoate', 'chlorpyrifos', 'fenthion', 'deltamethrin', 'lambda-cyhalothrin', 'cypermethrin', 'spinosad', 'spinetoram',
  'imidacloprid', 'acetamiprid', 'phosmet', 'malathion', 'fungicide', 'insecticide', 'pesticide', 'herbicide',
  'fungisit', 'insektisit', 'pestisit', 'bakır', 'μυκητοκτόν', 'εντομοκτόν', 'φυτοφάρμακ', 'χαλκ',
];

/** A dose such as "3 kg/ha", "2 l/ha", "50 ml per 100 l". */
const DOSE = /\b\d+([.,]\d+)?\s*(kg|g|l|lt|ml|litre|liter|λίτρ\w*|γραμ\w*)\s*(\/|per|ανά|başına)\s*(ha|hectare|100\s*l|dekar|στρέμμα)/i;

/** True when a text names a chemical or a dose. */
export function containsChemicalAdvice(text: string): boolean {
  const t = text.toLowerCase();
  return CHEMICAL_WORDS.some((w) => t.includes(w)) || DOSE.test(t);
}

/** All strings of an object, to check them in one go. */
export function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

/** Numbers that appear in a text (e.g. "12 flies", "34 %"). Used to check the advisor invents no numbers. */
export function numbersIn(text: string): number[] {
  return (text.match(/\d+([.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
}

/** Sentences in a text, split on . ! ? and the Greek question mark. */
export function sentenceCount(text: string): number {
  return text.split(/[.!?;]+(?:\s|$)/).filter((s) => s.trim().length > 0).length;
}
