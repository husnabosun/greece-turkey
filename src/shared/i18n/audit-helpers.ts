/**
 * Static-analysis helpers for the i18n audit tests (node only; never imported by app code).
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";

export const LOCALES = ["en", "el", "tr"] as const;
export type AuditLocale = (typeof LOCALES)[number];

const ROOT = process.cwd();
export const SRC_DIR = path.join(ROOT, "src");
export const MESSAGES_DIR = path.join(SRC_DIR, "shared/i18n/messages");

export function loadMessages(locale: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8")) as Record<string, unknown>;
}

/** Flatten nested messages to `ns.key.sub` -> string. */
export function flattenMessages(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flattenMessages(v as Record<string, unknown>, next));
    else out[next] = String(v);
  }
  return out;
}

export function walkSource(dir = SRC_DIR, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSource(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

export type ArgKind = "plain" | "number" | "date" | "time" | "plural" | "select" | "selectordinal" | "tag";
export type MessageArg = { name: string; kind: ArgKind };

type AstNode = {
  type: number;
  value?: string;
  options?: Record<string, { value: AstNode[] }>;
  children?: AstNode[];
  pluralType?: string;
};

// @formatjs/icu-messageformat-parser TYPE enum
const T = { literal: 0, argument: 1, number: 2, date: 3, time: 4, select: 5, plural: 6, pound: 7, tag: 8 } as const;

/** Throws when the message is not valid ICU (what next-intl reports as FORMATTING_ERROR). */
export function messageArgs(message: string): MessageArg[] {
  const ast = parse(message, { ignoreTag: false, requiresOtherClause: true }) as unknown as AstNode[];
  const found = new Map<string, ArgKind>();
  const visit = (nodes: AstNode[]) => {
    for (const n of nodes) {
      switch (n.type) {
        case T.argument:
          if (!found.has(n.value!)) found.set(n.value!, "plain");
          break;
        case T.number:
          found.set(n.value!, "number");
          break;
        case T.date:
          found.set(n.value!, "date");
          break;
        case T.time:
          found.set(n.value!, "time");
          break;
        case T.select:
        case T.plural:
          found.set(n.value!, n.type === T.select ? "select" : n.pluralType === "ordinal" ? "selectordinal" : "plural");
          for (const o of Object.values(n.options ?? {})) visit(o.value);
          break;
        case T.tag:
          found.set(n.value!, "tag");
          visit(n.children ?? []);
          break;
        default:
          break;
      }
    }
  };
  visit(ast);
  return [...found].map(([name, kind]) => ({ name, kind })).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------
// Call-site scanner
// ---------------------------------------------------------------------------------------------

/** Index of the `)` that closes the `(` at `open`, skipping strings, template literals and comments. */
function matchParen(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i]!;
    if (c === '"' || c === "'") {
      i = skipString(src, i, c);
    } else if (c === "`") {
      i = skipTemplate(src, i);
    } else if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) return -1;
    } else if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2);
      if (i < 0) return -1;
      i += 1;
    } else if (c === "(" || c === "{" || c === "[") {
      depth++;
    } else if (c === ")" || c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function skipString(src: string, start: number, quote: string): number {
  for (let i = start + 1; i < src.length; i++) {
    if (src[i] === "\\") i++;
    else if (src[i] === quote) return i;
  }
  return src.length;
}

function skipTemplate(src: string, start: number): number {
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") i++;
    else if (c === "`") return i;
    else if (c === "$" && src[i + 1] === "{") {
      const close = matchParen(src, i + 1);
      if (close < 0) return src.length;
      i = close;
    }
  }
  return src.length;
}

/** Split `a, b, c` at depth 0 (commas inside brackets / strings are kept). */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"' || c === "'") i = skipString(text, i, c);
    else if (c === "`") i = skipTemplate(text, i);
    else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(text.slice(last, i));
      last = i + 1;
    }
  }
  const tail = text.slice(last);
  if (tail.trim()) parts.push(tail);
  return parts.map((p) => p.trim());
}

export type TCall = {
  alias: string;
  line: number;
  /** Literal keys found in the first argument (several for `cond ? "a" : "b"`). */
  keys: string[];
  /** First argument is a template literal / expression: `{ prefix, suffix }` of the literal parts. */
  dynamic: { prefix: string; suffix: string } | null;
  /** Top-level keys of an inline `{ ... }` values argument; null when absent / not an object literal. */
  valueKeys: string[] | null;
  /** The values argument exists but its keys are unknowable (identifier, spread, call). */
  valuesOpaque: boolean;
  hasValuesArg: boolean;
  rich: boolean;
};

const IDENT = /^[A-Za-z_$][\w$]*$/;

function objectKeys(objText: string): { keys: string[]; opaque: boolean } {
  const inner = objText.trim().slice(1, -1);
  const keys: string[] = [];
  let opaque = false;
  for (const part of splitTopLevel(inner)) {
    if (part.startsWith("...")) {
      opaque = true;
      continue;
    }
    const m = part.match(/^(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*(?::|$)/);
    if (m) keys.push((m[1] ?? m[2])!);
    else if (IDENT.test(part)) keys.push(part);
    else if (/^\[/.test(part)) opaque = true;
  }
  return { keys, opaque };
}

export function lineOf(src: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

/** Find `alias("key", { values })` and `alias.rich("key", { values })` calls. */
export function findTCalls(src: string, alias: string): TCall[] {
  const calls: TCall[] = [];
  const re = new RegExp(`(?<![\\w$.])${alias.replace(/\$/g, "\\$")}(\\.rich)?\\(`, "g");
  for (const m of src.matchAll(re)) {
    const open = m.index! + m[0].length - 1;
    const close = matchParen(src, open);
    if (close < 0) continue;
    const args = splitTopLevel(src.slice(open + 1, close));
    if (args.length === 0) continue;
    const first = args[0]!;
    const keys: string[] = [];
    let dynamic: TCall["dynamic"] = null;

    const tpl = first.match(/^`([\s\S]*)`$/);
    if (tpl && tpl[1]!.includes("${")) {
      const body = tpl[1]!;
      dynamic = { prefix: body.slice(0, body.indexOf("${")), suffix: body.slice(body.lastIndexOf("}") + 1) };
    } else if (/^["'`][^"'`]*["'`]$/.test(first)) {
      keys.push(first.slice(1, -1));
    } else {
      // conditional / mixed expression: the string literals that are RESULTS, not operands of a comparison
      for (const lit of first.matchAll(/["']([A-Za-z][\w.]*)["']/g)) {
        const before = first.slice(0, lit.index).trimEnd();
        const after = first.slice(lit.index! + lit[0].length).trimStart();
        if (/(?:===|!==|==|!=|\.includes\(|\.startsWith\()$/.test(before)) continue;
        if (/^(?:===|!==|==|!=)/.test(after)) continue;
        keys.push(lit[1]!);
      }
      if (/\?/.test(first) === false && keys.length === 0) continue; // bare identifier: untraceable
    }

    const valuesArg = args[1];
    let valueKeys: string[] | null = null;
    let opaque = false;
    if (valuesArg !== undefined) {
      if (valuesArg.startsWith("{")) {
        const r = objectKeys(valuesArg);
        valueKeys = r.keys;
        opaque = r.opaque;
      } else {
        opaque = true;
      }
    }
    calls.push({
      alias,
      line: lineOf(src, m.index!),
      keys,
      dynamic,
      valueKeys,
      valuesOpaque: opaque,
      hasValuesArg: valuesArg !== undefined,
      rich: Boolean(m[1]),
    });
  }
  return calls;
}

/** `const t = useTranslations("ns")` / `await getTranslations("ns")` bindings in one file. */
export function translationBindings(src: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const re = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of src.matchAll(re)) {
    const alias = m[1]!;
    if (!map.has(alias)) map.set(alias, new Set());
    map.get(alias)!.add(m[2]!);
  }
  return map;
}

/** Placeholders a call must supply: ICU args except rich-text tags. */
export function requiredValueNames(args: MessageArg[], rich: boolean): string[] {
  return args.filter((a) => (rich ? a.kind !== "tag" || true : a.kind !== "tag")).map((a) => a.name);
}
