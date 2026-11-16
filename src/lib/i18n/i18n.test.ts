import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { DICTS, translate } from '.';
import { el } from './el';
import { tr } from './tr';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !n.endsWith('.test.ts') ? [p] : [];
  });
}

/** Every string literal inside a `t(...)` call of the farmer app. */
function sourceKeys(): string[] {
  const root = join(__dirname, '..', '..', '..');
  const dirs = ['app/farmer', 'src/features', 'src/components'].map((d) => join(root, d));
  const keys = new Set<string>();
  const call = /\bt\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g;
  const literal = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  for (const f of dirs.flatMap(files)) {
    if (f.includes(`${join('src', 'features', 'processor')}`) || f.includes('landing')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(call)) {
      // Skip the vars object: only literals before the first "{ " count as keys.
      const args = m[1].split(/,\s*\{\s/)[0];
      for (const l of args.matchAll(literal)) {
        // `x === 'healthy'` is a comparison, not a text.
        if (/[!=]==\s*$/.test(args.slice(0, l.index))) continue;
        const raw = (l[1] ?? l[2]).replace(/\\n/g, '\n').replace(/\\'/g, "'");
        if (raw.trim()) keys.add(raw);
      }
    }
  }
  return [...keys];
}

describe('translations', () => {
  it('Turkish and Greek have the same keys', () => {
    expect(Object.keys(tr).filter((k) => !(k in el))).toEqual([]);
    expect(Object.keys(el).filter((k) => !(k in tr))).toEqual([]);
  });

  it('keep every {placeholder} of the English text', () => {
    for (const [lang, dict] of Object.entries(DICTS)) {
      const bad = Object.entries(dict).filter(([k, v]) => placeholders(k) !== placeholders(v));
      expect({ lang, bad }).toEqual({ lang, bad: [] });
    }
  });

  it('cover every t("…") text in the farmer app', () => {
    const missing = sourceKeys().filter((k) => !(k in tr) && translate('tr', k) === k);
    expect(missing).toEqual([]);
  });

  it('fills placeholders and falls back to English', () => {
    expect(translate('tr', '{n} trees', { n: 40 })).toBe('40 ağaç');
    expect(translate('en', '{n} trees', { n: 40 })).toBe('40 trees');
    expect(translate('el', 'Some text we never translated')).toBe('Some text we never translated');
  });

  it('translates sentences built in src/lib through templates', () => {
    expect(translate('tr', '3 rainy days in the last 14 days, leaves wet about 6 h a day')).toBe('Son 14 günde 3 yağmurlu gün, yapraklar günde yaklaşık 6 saat ıslak');
    expect(translate('tr', 'Peacock spot is likely in the ripening season')).toBe('olgunlaşma döneminde halkalı leke olası');
    expect(translate('el', 'Fly trap · 14 flies')).toBe('Παγίδα δάκου · 14 μύγες');
    expect(translate('tr', '12 Oct 2026')).toBe('12 Eki 2026');
    expect(translate('tr', 'Today, 09:12')).toBe('Bugün, 09:12');
    expect(translate('tr', 'We are very sure this is peacock spot.')).toBe('Bunun halkalı leke olduğundan çok eminiz.');
    expect(translate('el', 'North grove, rows 1–6')).toBe('North grove, σειρές 1–6');
  });
});
