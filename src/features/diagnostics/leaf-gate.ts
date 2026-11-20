import { geminiJsonDetailed, hasGeminiKey } from "@/features/diagnostics/gemini";
import { LEAF_GATE_PROMPT } from "@/features/diagnostics/prompts";
import { leafGateResult, type LeafGateResult } from "@/features/diagnostics/schemas";

export type LeafGateOutcome =
  | { ok: true; pass: true; data: LeafGateResult }
  | { ok: true; pass: false; data: LeafGateResult }
  | { ok: false; skipped: true; reason: "no_key" | "api" };

/**
 * Gemini gate before the leaf disease model.
 * If Gemini is unavailable we skip (caller still applies confidence thresholds).
 */
export async function gateOliveLeaf(imageBase64: string): Promise<LeafGateOutcome> {
  if (!hasGeminiKey()) return { ok: false, skipped: true, reason: "no_key" };

  const live = await geminiJsonDetailed({
    prompt: LEAF_GATE_PROMPT,
    schema: leafGateResult,
    imageBase64,
    timeoutMs: 20_000,
  });

  if (!live.ok) return { ok: false, skipped: true, reason: "api" };

  const pass = live.data.isOliveLeaf && live.data.confidence >= 0.55;
  return pass
    ? { ok: true, pass: true, data: live.data }
    : { ok: true, pass: false, data: live.data };
}
