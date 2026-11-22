/**
 * Runs the fruit, trap and label scan flows on a folder of photos and prints what the farmer would see.
 * It calls the same code as the API routes (src/features/diagnostics/scan-flows.ts), with the real Vertex AI.
 *
 *   npx tsx --env-file=.env.local scripts/scan-eval.ts [--dir ./test-photos] [--lang en|el|tr] [--only fruit|trap|label]
 *
 * Folder layout:  test-photos/fruit/*.jpg   test-photos/trap/*.jpg   test-photos/label/*.jpg
 *                 or flat files named after the scan type: test-photos/fruit-healthy.webp, trap-flies-5.jpg, label-ok.png
 * Optional expected result in the file name, before two underscores (flat files: after the scan type):
 *   fruit/olive-fly__tree3.jpg      anthracnose, olive-moth, hail-or-mechanical-damage, sunscald, drought-shrivel,
 *                                   sooty-mould-or-scale, healthy, unsure, retake
 *   trap/flies-5__trap1.jpg         flies-N, empty, retake, unsure   (the count may be off by 2)
 *   label/ok__copper.jpg            ok, retake
 * The photos stay on your computer, except for the calls to Vertex AI. Nothing is written to the database.
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { hasGeminiKey } from "../src/features/diagnostics/gemini";
import { checkImageBase64 } from "../src/features/diagnostics/image-check";
import { runFruitScan, runLabelScan, runTrapScan } from "../src/features/diagnostics/scan-flows";
import { MAX_IMAGE_BYTES, type Language } from "../src/features/diagnostics/schemas";

type Mode = "fruit" | "trap" | "label";
const MODES: Mode[] = ["fruit", "trap", "label"];
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dir = resolve(arg("dir", "./test-photos"));
const language = arg("lang", "en") as Language;
const only = arg("only", "") as Mode | "";

type Row = { mode: Mode; file: string; expected: string; actual: string; ok: boolean | null; confidence: string; text: string; ms: number };

const dash = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The expected result written in the file name, or "" when there is none. */
function expectedOf(file: string, flatMode?: Mode): string {
  if (flatMode) {
    // fruit-healthy.webp, fruit-olive-fly-2.jpg, trap-flies-5.jpg, label-ok__copper.png
    const stem = file.slice(0, file.length - extname(file).length).slice(flatMode.length + 1).split("__")[0].toLowerCase();
    return /^flies-\d+$/.test(stem) ? stem : stem.replace(/[-_]\d+$/, "");
  }
  const i = file.indexOf("__");
  return i > 0 ? file.slice(0, i).toLowerCase() : "";
}

/** "olive-fly", "olivefly" and "fly" all mean the same here. Only letters and digits count. */
const squash = (s: string) => s.replace(/[^a-z0-9]/g, "");

function matches(mode: Mode, expected: string, actual: string): boolean | null {
  if (!expected) return null;
  if (mode === "trap" && expected === "empty") return actual === "flies-0";
  if (mode === "trap" && expected.startsWith("flies-") && actual.startsWith("flies-")) {
    return Math.abs(Number(expected.slice(6)) - Number(actual.slice(6))) <= 2;
  }
  return expected === actual || (squash(expected).length >= 3 && squash(actual).includes(squash(expected)));
}

async function runOne(mode: Mode, path: string, file: string, flat = false): Promise<Row> {
  const started = Date.now();
  const base: Pick<Row, "mode" | "file" | "expected"> = { mode, file, expected: expectedOf(file, flat ? mode : undefined) };
  const bytes = readFileSync(path);
  const b64 = bytes.toString("base64");
  const row = (actual: string, confidence: string, text: string): Row => ({
    ...base,
    actual,
    confidence,
    text,
    ok: matches(mode, base.expected, actual),
    ms: Date.now() - started,
  });

  if (bytes.length > MAX_IMAGE_BYTES) return row("skipped", "", `file is ${(bytes.length / 1e6).toFixed(1)} MB, the app resizes to under 4 MB first`);
  const check = checkImageBase64(b64);
  if (!check.ok) return row("skipped", "", `the API would reject this file (${check.code})`);

  if (mode === "label") {
    const run = await runLabelScan(b64);
    if (!run.ok) return row("unavailable", "", `${run.reason}${run.detail ? `: ${run.detail}` : ""}`);
    const r = run.result;
    const found = `${r.productName} | ${r.activeSubstances.join(", ")}`;
    return row(run.verdict.kind === "retake" ? "retake" : "ok", r.confidence.toFixed(2), run.verdict.kind === "retake" ? `${run.verdict.reason} (photo: ${r.photo})` : found);
  }

  const run = mode === "fruit" ? await runFruitScan({ images: [b64], language }) : await runTrapScan({ images: [b64], language });
  if (!run.ok) return row("unavailable", "", `${run.reason}${run.detail ? `: ${run.detail}` : ""}`);
  const r = run.result;
  const confidence = r.confidence.toFixed(2);
  if (run.verdict.kind === "retake") return row("retake", confidence, `${run.verdict.reason}`);
  if (run.verdict.kind === "unsure") {
    const guess = "diagnosis" in r ? r.diagnosis : `${r.flyCount} flies`;
    return row("unsure", confidence, `model said: ${guess}. ${r.summary}`);
  }
  if ("diagnosis" in r) return row(dash(r.diagnosis), confidence, r.summary);
  const extra = [r.mothCount > 0 ? `${r.mothCount} moths` : "", r.otherInsects ? "other insects" : ""].filter(Boolean).join(", ");
  return row(`flies-${r.flyCount}`, confidence, `${r.summary}${extra ? ` [${extra}]` : ""}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Vertex answers "resource exhausted" when calls come too fast. Wait and try again (up to 3 times). */
async function runWithRetry(mode: Mode, path: string, file: string, flat: boolean): Promise<Row> {
  let r = await runOne(mode, path, file, flat);
  for (let i = 0; i < 3 && r.actual === "unavailable" && /exhausted|429|quota/i.test(r.text); i++) {
    await sleep(10_000 * (i + 1));
    r = await runOne(mode, path, file, flat);
  }
  return r;
}

async function main() {
  if (!existsSync(dir)) {
    console.error(`Folder not found: ${dir}\nCreate test-photos/fruit, test-photos/trap and test-photos/label and put photos in them.`);
    process.exit(1);
  }
  if (!hasGeminiKey()) {
    console.error("Vertex AI is not set up here: need GOOGLE_CLOUD_PROJECT in .env.local and gcp-service-account.json in the project root.");
    console.error("Run with: npx tsx --env-file=.env.local scripts/scan-eval.ts");
    process.exit(1);
  }

  const rows: Row[] = [];
  const isImage = (folder: string, f: string) => IMAGE_EXT.has(extname(f).toLowerCase()) && statSync(join(folder, f)).isFile();
  for (const mode of MODES) {
    if (only && only !== mode) continue;
    const folder = join(dir, mode);
    const inFolder = existsSync(folder) ? readdirSync(folder).filter((f) => isImage(folder, f)).sort().map((f) => ({ path: join(folder, f), file: f, flat: false })) : [];
    const flat = readdirSync(dir).filter((f) => f.toLowerCase().startsWith(`${mode}-`) && isImage(dir, f)).sort().map((f) => ({ path: join(dir, f), file: f, flat: true }));
    for (const { path, file, flat: isFlat } of [...inFolder, ...flat]) {
      const r = await runWithRetry(mode, path, file, isFlat);
      rows.push(r);
      const mark = r.ok === null ? " " : r.ok ? "✓" : "✗";
      console.log(`${mark} ${mode.padEnd(5)} ${cut(file, 34).padEnd(34)} → ${r.actual.padEnd(26)} ${r.confidence.padEnd(4)} ${cut(r.text, 90)}`);
    }
  }

  if (rows.length === 0) {
    console.log("No photos found. Put .jpg/.png/.webp files in test-photos/fruit, test-photos/trap and test-photos/label.");
    return;
  }

  const judged = rows.filter((r) => r.ok !== null);
  const right = judged.filter((r) => r.ok).length;
  const count = (k: string) => rows.filter((r) => r.actual === k).length;
  console.log(
    `\n${rows.length} photos · ${count("retake")} retake · ${count("unsure")} unsure · ${count("unavailable")} AI unavailable · ${count("skipped")} skipped` +
      (judged.length ? ` · matches the file name: ${right}/${judged.length}` : ""),
  );

  const lines = ["| mode | file | expected | result | confidence | text |", "|---|---|---|---|---|---|"].concat(
    rows.map((r) => `| ${r.mode} | ${r.file} | ${r.expected || "-"} | ${r.actual}${r.ok === false ? " ✗" : r.ok ? " ✓" : ""} | ${r.confidence} | ${r.text.replace(/\|/g, "/")} |`),
  );
  writeFileSync(join(dir, "_results.md"), `${lines.join("\n")}\n`, "utf8");
  console.log(`Table saved to ${join(dir, "_results.md")}`);
}

void main();
