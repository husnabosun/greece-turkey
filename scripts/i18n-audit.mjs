#!/usr/bin/env node
/**
 * i18n audit (report only). Usage: node scripts/i18n-audit.mjs [hardcoded|leaks|format|unused|all]
 *
 * - hardcoded: user-visible string literals in JSX text / attributes / toast calls
 * - leaks:     Greek or Turkish letters inside source files (outside messages/*.json)
 * - format:    hand-built dates / numbers / currency / area strings
 * - unused:    message keys that no source file references (static + dynamic-prefix aware)
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const MSG = path.join(SRC, "shared/i18n/messages");
const mode = process.argv[2] ?? "all";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(e.name) && !/\.test\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");
const hasLetters = (s) => /\p{L}{2,}/u.test(s);
const GREEK = /[Ͱ-Ͽἀ-῿]/;
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

function line(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

const VISIBLE_ATTRS = new Set(["aria-label", "placeholder", "title", "alt", "label", "description", "aria-description", "helperText"]);

function hardcoded() {
  const rows = [];
  for (const file of files) {
    if (file.endsWith(".mjs")) continue;
    const text = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const push = (node, kind, value) => rows.push({ file: rel(file), line: line(sf, node), kind, value: value.replace(/\s+/g, " ").trim().slice(0, 90) });
    const visit = (node) => {
      if (ts.isJsxText(node)) {
        const v = node.getText(sf);
        if (hasLetters(v)) push(node, "jsx-text", v);
      } else if (ts.isJsxAttribute(node) && node.initializer && VISIBLE_ATTRS.has(node.name.getText(sf))) {
        const init = node.initializer;
        if (ts.isStringLiteral(init) && hasLetters(init.text)) push(node, `attr:${node.name.getText(sf)}`, init.text);
        else if (ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression)) && hasLetters(init.expression.text))
          push(node, `attr:${node.name.getText(sf)}`, init.expression.text);
      } else if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(sf);
        if (/^toast(\.\w+)?$/.test(callee) || /^(setError|setMessage|setNotice)$/.test(callee)) {
          const a = node.arguments[0];
          if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && hasLetters(a.text)) push(node, `call:${callee}`, a.text);
        }
      } else if (ts.isThrowStatement(node) && node.expression && ts.isNewExpression(node.expression)) {
        // thrown messages are internal; skip
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return rows;
}

function leaks() {
  const rows = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((l, i) => {
      if (GREEK.test(l) || TURKISH.test(l)) rows.push({ file: rel(file), line: i + 1, kind: GREEK.test(l) ? "greek" : "turkish", value: l.trim().slice(0, 110) });
    });
  }
  return rows;
}

function format() {
  const rows = [];
  const pats = [
    [/\.toFixed\(/, "toFixed"],
    [/toLocale(Date|Time)?String\(\s*(undefined|["'][a-z]{2}(-[A-Z]{2})?["'])?\s*[,)]/, "toLocale* w/o dynamic locale"],
    [/["'`]\s*€|€\s*["'`]|\$\{[^}]+\}\s*€|€\s*\$\{/, "hand-built €"],
    [/["'`]\s*(ha|stremmata|στρ\.|dönüm|kg|tons?)\b|\}\s*(ha|stremmata|dönüm)\b/, "hand-built unit"],
    [/["'](el|tr|en)-(GR|TR|GB|US)["']/, "hard-coded locale tag"],
    [/new Date\([^)]*\)\.(getDate|getMonth|getFullYear)\(\)[^;]*\+/, "hand-built date"],
  ];
  for (const file of files) {
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((l, i) => {
      for (const [re, kind] of pats) if (re.test(l)) rows.push({ file: rel(file), line: i + 1, kind, value: l.trim().slice(0, 120) });
    });
  }
  return rows;
}

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, prefix ? `${prefix}.${k}` : k) : [prefix ? `${prefix}.${k}` : k]));
}

function unused() {
  const en = JSON.parse(fs.readFileSync(path.join(MSG, "en.json"), "utf8"));
  const keys = flatten(en);
  // per-file: bound namespaces + string literals + template fragments
  const perFile = files.map((f) => {
    const text = fs.readFileSync(f, "utf8");
    const nss = new Set([...text.matchAll(/(?:useTranslations|getTranslations)\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]));
    const lits = new Set([...text.matchAll(/["'`]([A-Za-z0-9_.\-]+)["'`]/g)].map((m) => m[1]));
    const prefixes = [...text.matchAll(/`([A-Za-z0-9_.\-]*)\$\{/g)].map((m) => m[1]).filter(Boolean);
    const suffixes = [...text.matchAll(/\$\{[^}]+\}([A-Za-z0-9_.\-]+)`/g)].map((m) => m[1]);
    return { nss, lits, prefixes, suffixes };
  });
  const out = [];
  for (const k of keys) {
    const parts = k.split(".");
    const leaf = parts[parts.length - 1];
    const ns = parts.slice(0, -1).join(".");
    const hit = (f, strict) => {
      const bound = [...f.nss].some((n) => n === ns || ns.startsWith(n + ".") || n.startsWith(ns + "."));
      if (strict && !bound) return false;
      return f.lits.has(leaf) || f.lits.has(k) || f.prefixes.some((p) => leaf.startsWith(p)) || f.suffixes.some((x) => leaf.endsWith(x));
    };
    if (perFile.some((f) => hit(f, true))) continue;
    const loose = perFile.some((f) => hit(f, false));
    out.push({ file: ns || "(root)", line: 0, kind: loose ? "maybe (name appears elsewhere)" : "unused", value: k });
  }
  return out;
}

const all = { hardcoded, leaks, format, unused };
const modes = mode === "all" ? Object.keys(all) : [mode];
for (const m of modes) {
  const rows = all[m]();
  console.log(`\n=== ${m}: ${rows.length} ===`);
  const byFile = new Map();
  for (const r of rows) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }
  for (const [f, rs] of byFile) {
    console.log(`\n${f} (${rs.length})`);
    for (const r of rs) console.log(`  ${r.line}\t${r.kind}\t${r.value}`);
  }
}
