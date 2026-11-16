/**
 * App translation. The English text is the key, so English needs no dictionary and a missing
 * translation simply shows the English text.
 *
 * Keys may hold `{name}` placeholders:
 *  - in the UI: `t('{n} trees', { n: 40 })`
 *  - for text built in `src/lib` (risk reasons, weather labels…): the finished English sentence is
 *    matched against the templates, and each captured part is translated again if it has a translation.
 */
import type { Language } from '@/lib/ai/schemas';
import { el } from './el';
import { tr } from './tr';

export type Vars = Record<string, string | number>;
export type Dict = Record<string, string>;

export const DICTS: Record<Exclude<Language, 'en'>, Dict> = { tr, el };

/** Name of each language in its own language, for the language picker. */
export const LANGUAGE_LABEL: Record<Language, string> = { en: 'English', tr: 'Türkçe', el: 'Ελληνικά' };

/** Locale for dates and numbers. */
export const LOCALE: Record<Language, string> = { en: 'en-GB', tr: 'tr-TR', el: 'el-GR' };

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text);

interface Template {
  re: RegExp;
  names: string[];
  out: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const templateCache = new Map<Dict, Template[]>();

function templatesOf(dict: Dict): Template[] {
  let list = templateCache.get(dict);
  if (list) return list;
  list = [];
  for (const [key, out] of Object.entries(dict)) {
    if (!key.includes('{')) continue;
    const names: string[] = [];
    const parts = key.split(/\{(\w+)\}/g);
    let src = '^';
    parts.forEach((p, i) => {
      if (i % 2) {
        names.push(p);
        src += '(.+?)';
      } else src += escape(p);
    });
    list.push({ re: new RegExp(`${src}$`), names, out });
  }
  // Longer (more specific) templates first.
  list.sort((a, b) => b.re.source.length - a.re.source.length);
  templateCache.set(dict, list);
  return list;
}

/** Translates `text` to `lang`. Falls back to the English text. */
export function translate(lang: Language, text: string, vars?: Vars): string {
  if (lang === 'en' || !text) return fill(text, vars);
  const dict = DICTS[lang];
  const hit = dict[text];
  if (hit !== undefined) return fill(hit, vars);
  if (vars) return fill(text, vars);
  return matchTemplate(dict, text) ?? text;
}

function matchTemplate(dict: Dict, text: string, depth = 0): string | undefined {
  if (depth > 3) return undefined;
  for (const t of templatesOf(dict)) {
    const m = t.re.exec(text);
    if (!m) continue;
    const vars: Vars = {};
    t.names.forEach((n, i) => {
      const v = m[i + 1];
      vars[n] = dict[v] ?? dict[v.toLowerCase()] ?? matchTemplate(dict, v, depth + 1) ?? v;
    });
    return fill(t.out, vars);
  }
  return undefined;
}

export type T = (text: string, vars?: Vars) => string;
