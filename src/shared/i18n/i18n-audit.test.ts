import fs from "node:fs";
import path from "node:path";
import { createTranslator } from "use-intl/core";
import { describe, expect, it } from "vitest";
import {
  LOCALES,
  findTCalls,
  flattenMessages,
  loadMessages,
  messageArgs,
  translationBindings,
  walkSource,
  type AuditLocale,
  type MessageArg,
} from "@/shared/i18n/audit-helpers";

const flat = Object.fromEntries(LOCALES.map((l) => [l, flattenMessages(loadMessages(l))])) as Record<
  AuditLocale,
  Record<string, string>
>;
const rel = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, "/");

const argsCache = new Map<string, MessageArg[] | Error>();
function argsOf(locale: AuditLocale, key: string): MessageArg[] | Error {
  const id = `${locale}:${key}`;
  if (!argsCache.has(id)) {
    try {
      argsCache.set(id, messageArgs(flat[locale][key]!));
    } catch (e) {
      argsCache.set(id, e instanceof Error ? e : new Error(String(e)));
    }
  }
  return argsCache.get(id)!;
}

describe("i18n: message syntax", () => {
  it("every message in every language is valid ICU (no FORMATTING_ERROR at runtime)", () => {
    const bad: string[] = [];
    for (const locale of LOCALES) {
      for (const key of Object.keys(flat[locale])) {
        const r = argsOf(locale, key);
        if (r instanceof Error) bad.push(`${locale}:${key} -> ${r.message}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("no message is empty", () => {
    const empty: string[] = [];
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(flat[locale])) if (!value.trim()) empty.push(`${locale}:${key}`);
    }
    expect(empty).toEqual([]);
  });
});

describe("i18n: placeholders match across languages", () => {
  it("el and tr use the same {variables} as en", () => {
    const diffs: string[] = [];
    for (const key of Object.keys(flat.en)) {
      const en = argsOf("en", key);
      if (en instanceof Error) continue;
      const names = en.map((a) => a.name).join(",");
      for (const locale of ["el", "tr"] as const) {
        const other = argsOf(locale, key);
        if (other instanceof Error) continue;
        const otherNames = other.map((a) => a.name).join(",");
        if (otherNames !== names) diffs.push(`${key}: en {${names}} vs ${locale} {${otherNames}}`);
      }
    }
    expect(diffs).toEqual([]);
  });

  it("Greek keeps a plural wherever English has one (Turkish does not inflect after numerals)", () => {
    const diffs: string[] = [];
    for (const key of Object.keys(flat.en)) {
      const en = argsOf("en", key);
      const el = argsOf("el", key);
      if (en instanceof Error || el instanceof Error) continue;
      for (const a of en.filter((x) => x.kind === "plural")) {
        if (el.find((x) => x.name === a.name)?.kind !== "plural") diffs.push(`${key}: ${a.name} is plural in en but not in el`);
      }
    }
    expect(diffs).toEqual([]);
  });
});

describe("i18n: plurals", () => {
  // English count + plural noun written without an ICU plural ("{n} offers", "{count} trees").
  const PLAIN_COUNT_NOUN = /\{(n|count|total|num|number)\}\s+[a-z]{3,}s\b/;

  it("English never hand-pluralises a count", () => {
    const bad = Object.entries(flat.en)
      .filter(([, v]) => PLAIN_COUNT_NOUN.test(v.replace(/\{[^{}]*\{[^{}]*\}[^{}]*\}/g, "")))
      .map(([k, v]) => `${k}: ${v}`);
    expect(bad).toEqual([]);
  });

  it("plural messages have an `other` branch in every language", () => {
    const bad: string[] = [];
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(flat[locale])) {
        if (/\{\w+,\s*plural,/.test(value) && !/\bother\s*\{/.test(value)) bad.push(`${locale}:${key}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("i18n: code uses existing keys and passes every placeholder", () => {
  const missing: string[] = [];
  const unpassed: string[] = [];
  const unknownExtras: string[] = [];

  for (const file of walkSource()) {
    const src = fs.readFileSync(file, "utf8");
    const bindings = translationBindings(src);
    if (bindings.size === 0) continue;

    for (const [alias, namespaces] of bindings) {
      for (const call of findTCalls(src, alias)) {
        const where = `${rel(file)}:${call.line}`;

        if (call.dynamic) {
          // `t(\`prefix${x}suffix\`)`: at least one key must fit, in every language.
          for (const locale of LOCALES) {
            const ok = [...namespaces].some((ns) =>
              Object.keys(flat[locale]).some((k) => {
                if (!k.startsWith(`${ns}.`)) return false;
                const leaf = k.slice(ns.length + 1);
                return leaf.startsWith(call.dynamic!.prefix) && leaf.endsWith(call.dynamic!.suffix) && leaf.length > call.dynamic!.prefix.length;
              }),
            );
            if (!ok) missing.push(`${where}: ${alias}(\`${call.dynamic.prefix}\${…}${call.dynamic.suffix}\`) matches no key in ${locale}`);
          }
          continue;
        }

        for (const key of call.keys) {
          for (const locale of LOCALES) {
            const fullKeys = [...namespaces].map((ns) => `${ns}.${key}`).filter((k) => k in flat[locale]);
            if (fullKeys.length === 0) {
              missing.push(`${where}: ${alias}("${key}") missing in ${locale} (${[...namespaces].map((ns) => `${ns}.${key}`).join(" | ")})`);
              continue;
            }
            if (call.valuesOpaque) continue;
            const passed = new Set(call.valueKeys ?? []);
            for (const full of fullKeys) {
              const args = argsOf(locale, full);
              if (args instanceof Error) continue;
              const need = args.filter((a) => a.kind !== "tag").map((a) => a.name);
              const absent = need.filter((n) => !passed.has(n));
              if (absent.length) unpassed.push(`${where}: ${alias}("${key}") in ${locale} needs {${absent.join(", ")}} but the call passes {${[...passed].join(", ")}}`);
            }
          }
          // values passed that no language uses are just noise; report only for a single literal key
          if (call.keys.length === 1 && call.valueKeys && !call.valuesOpaque) {
            const used = new Set<string>();
            for (const locale of LOCALES)
              for (const ns of namespaces) {
                const a = argsOf(locale, `${ns}.${key}`);
                if (a && !(a instanceof Error)) a.forEach((x) => used.add(x.name));
              }
            const extra = call.valueKeys.filter((v) => !used.has(v));
            if (extra.length && used.size > 0) unknownExtras.push(`${where}: ${alias}("${key}") passes unused {${extra.join(", ")}}`);
          }
        }
      }
    }
  }

  it("every t(\"…\") key exists in en, el and tr under its namespace", () => {
    expect([...new Set(missing)]).toEqual([]);
  });

  it("every {placeholder} in a message is passed by the call (no raw {weighedKg} on screen)", () => {
    expect([...new Set(unpassed)]).toEqual([]);
  });

  it("calls do not pass values no message uses", () => {
    expect([...new Set(unknownExtras)]).toEqual([]);
  });
});

describe("i18n audit scanner (self-test)", () => {
  it("finds literal keys, conditional result keys and inline values", () => {
    const src = `
      const a = t("one", { n, name: user.name });
      const b = t(ok === "x" ? "yes" : "no");
      const c = t(\`prefix_\${kind}_title\`);
      const d = t("withSpread", { ...rest });
      const e = t.rich("rich", { b: (c) => c });
    `;
    const calls = findTCalls(src, "t");
    expect(calls[0]).toMatchObject({ keys: ["one"], valueKeys: ["n", "name"], valuesOpaque: false });
    expect(calls[1]!.keys).toEqual(["yes", "no"]);
    expect(calls[2]!.dynamic).toEqual({ prefix: "prefix_", suffix: "_title" });
    expect(calls[3]).toMatchObject({ keys: ["withSpread"], valuesOpaque: true });
    expect(calls[4]).toMatchObject({ keys: ["rich"], rich: true, valueKeys: ["b"] });
  });

  it("reads ICU arguments including plural branches and rich tags", () => {
    expect(messageArgs("Hi {name}, {n, plural, one {# tree} other {# trees}} <b>x</b>")).toEqual([
      { name: "b", kind: "tag" },
      { name: "n", kind: "plural" },
      { name: "name", kind: "plain" },
    ]);
    expect(() => messageArgs("Broken {n")).toThrow();
  });
});

describe("i18n: runtime formatting", () => {
  it("every message formats with next-intl in every language without an error", () => {
    const failures: string[] = [];
    for (const locale of LOCALES) {
      const messages = loadMessages(locale);
      for (const key of Object.keys(flat[locale])) {
        const args = argsOf(locale, key);
        if (args instanceof Error) continue;
        const values: Record<string, unknown> = {};
        for (const a of args) {
          if (a.kind === "plural" || a.kind === "number" || a.kind === "selectordinal") values[a.name] = 2;
          else if (a.kind === "date" || a.kind === "time") values[a.name] = new Date("2026-11-22T10:00:00Z");
          else if (a.kind === "select") values[a.name] = "other";
          else if (a.kind === "tag") values[a.name] = (chunks: unknown) => String(chunks);
          else values[a.name] = "x";
        }
        const errors: string[] = [];
        const t = createTranslator({
          locale,
          messages: messages as never,
          onError: (e) => errors.push(`${e.code}: ${e.message}`),
        });
        const [ns, ...rest] = key.split(".");
        void ns;
        void rest;
        try {
          (t as unknown as (k: string, v: Record<string, unknown>) => unknown)(key, values);
        } catch (e) {
          errors.push(String(e));
        }
        if (errors.length) failures.push(`${locale}:${key} -> ${errors[0]}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
