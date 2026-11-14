import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LOCALES = ["en", "el", "tr"] as const;
const MESSAGES_DIR = path.join(process.cwd(), "src/shared/i18n/messages");
const SRC_DIR = path.join(process.cwd(), "src");

function loadMessages(locale: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

/** Flatten nested message objects to `"ns.key.sub"` leaf paths. */
function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatten(v as Record<string, unknown>, next));
    } else {
      keys.push(next);
    }
  }
  return keys;
}

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("i18n messages", () => {
  const byLocale = Object.fromEntries(LOCALES.map((l) => [l, loadMessages(l)])) as Record<
    (typeof LOCALES)[number],
    Record<string, unknown>
  >;
  const flat = Object.fromEntries(LOCALES.map((l) => [l, new Set(flatten(byLocale[l]).sort())])) as Record<
    (typeof LOCALES)[number],
    Set<string>
  >;

  it("el and tr have the same leaf keys as en", () => {
    const enKeys = [...flat.en].sort();
    expect([...flat.el].sort()).toEqual(enKeys);
    expect([...flat.tr].sort()).toEqual(enKeys);
  });

  it("every t(\"…\") under a useTranslations namespace exists in all locales", () => {
    const missing: string[] = [];

    for (const file of walkTsx(SRC_DIR)) {
      const src = fs.readFileSync(file, "utf8");
      const binders = [
        ...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*["']([^"']+)["']\s*\)/g),
      ];
      if (binders.length === 0) continue;

      // Alias → all namespaces bound to that name in this file (multiple components may reuse `t`).
      const aliasToNs = new Map<string, Set<string>>();
      for (const m of binders) {
        const alias = m[1]!;
        const ns = m[2]!;
        if (!aliasToNs.has(alias)) aliasToNs.set(alias, new Set());
        aliasToNs.get(alias)!.add(ns);
      }

      for (const [alias, namespaces] of aliasToNs) {
        const re = new RegExp(`\\b${alias}\\(\\s*["']([^"']+)["']`, "g");
        for (const m of src.matchAll(re)) {
          const key = m[1]!;
          for (const locale of LOCALES) {
            const found = [...namespaces].some((ns) => flat[locale].has(`${ns}.${key}`));
            if (!found) {
              const tried = [...namespaces].map((ns) => `${ns}.${key}`).join(" | ");
              missing.push(
                `${path.relative(process.cwd(), file)}: ${alias}("${key}") → missing in ${locale} (${tried})`,
              );
            }
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
