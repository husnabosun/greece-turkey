import { containsChemicalAdvice, sentenceCount } from "./safety";
import type { FruitResult, LabelResult, TrapResult } from "./schemas";

/** Below this confidence the app says "I'm not sure" instead of showing a diagnosis. */
export const UNSURE_BELOW = 0.6;

/** Why the farmer should take a new photo. */
export type RetakeReason =
  | "not_olive"
  | "wrong_scan_type"
  | "blurry"
  | "too_dark"
  | "catch_not_visible"
  | "not_a_label"
  | "cut_off"
  | "unclear";

/**
 * What the app does with an AI answer:
 * - ok: show it.
 * - retake: the photo is not usable. Show the reason and no diagnosis.
 * - unsure: the AI is not sure, or its text broke a rule. Say "ask an agronomist", no diagnosis.
 */
export type Verdict = { kind: "ok" } | { kind: "retake"; reason: RetakeReason } | { kind: "unsure" };

const OK: Verdict = { kind: "ok" };
const UNSURE: Verdict = { kind: "unsure" };

/** One or two sentences, no chemical, no dose. The farmer reads this text, so it must follow the safety rules. */
export function summaryIsSafe(summary: string): boolean {
  const text = summary.trim();
  return text.length > 0 && sentenceCount(text) <= 2 && !containsChemicalAdvice(text);
}

export function judgeFruit(r: FruitResult): Verdict {
  if (r.photo !== "ok") return { kind: "retake", reason: r.photo };
  if (r.diagnosis === "unclear" || r.confidence < UNSURE_BELOW || !summaryIsSafe(r.summary)) return UNSURE;
  return OK;
}

export function judgeTrap(r: TrapResult): Verdict {
  if (r.photo !== "ok") return { kind: "retake", reason: r.photo };
  if (r.confidence < UNSURE_BELOW || !summaryIsSafe(r.summary)) return UNSURE;
  return OK;
}

/** A label is only used to fill the form when it was read with confidence. Substance names are printed on it, so no chemical filter here. */
export function judgeLabel(r: LabelResult): Verdict {
  if (r.photo !== "ok") return { kind: "retake", reason: r.photo };
  const nothingRead = !r.productName.trim() && r.activeSubstances.length === 0;
  if (nothingRead) return { kind: "retake", reason: "not_a_label" };
  if (r.confidence < UNSURE_BELOW) return { kind: "retake", reason: "unclear" };
  return OK;
}
