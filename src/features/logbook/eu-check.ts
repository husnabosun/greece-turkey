/**
 * Checks active substances against a short list of substances that are NOT approved in the EU.
 * Demo data: it is not the legal register. Before a real launch, replace it with the EU Pesticides Database
 * (https://ec.europa.eu/food/plant/pesticides/eu-pesticides-database) or the national register of Türkiye / Greece.
 */
export const EU_NOT_APPROVED = [
  'chlorpyrifos', // includes chlorpyrifos-methyl; not approved since 2020
  'dimethoate', // olive fly spray, withdrawn 2019
  'fenthion', // olive fly bait spray, not approved since 2015
  'carbendazim',
  'paraquat',
  'mancozeb', // not renewed 2021
  'imidacloprid', // outdoor use banned 2018
  'thiamethoxam', // outdoor use banned 2018
  'clothianidin', // outdoor use banned 2018
  'malathion',
  'diazinon',
  'endosulfan',
  'methidathion',
  'phosmet', // not renewed 2022
] as const;

export interface EuCheck {
  /** True when at least one substance is on the list. */
  banned: boolean;
  /** The substances that matched (from the list). */
  hits: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export function euCheck(activeSubstances: string[]): EuCheck {
  const hits = new Set<string>();
  for (const s of activeSubstances) {
    const n = norm(s);
    for (const banned of EU_NOT_APPROVED) if (n.includes(norm(banned))) hits.add(banned);
  }
  return { banned: hits.size > 0, hits: [...hits] };
}
