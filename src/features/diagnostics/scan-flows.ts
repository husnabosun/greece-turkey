import { geminiJsonDetailed } from "./gemini";
import { FRUIT_PROMPT, LABEL_PROMPT, TRAP_PROMPT } from "./prompts";
import { judgeFruit, judgeLabel, judgeTrap, type Verdict } from "./scan-verdict";
import {
  fruitResult,
  LANGUAGE_NAME,
  labelResult,
  trapResult,
  type DiagnoseRequest,
  type FruitResult,
  type LabelResult,
  type Language,
  type TrapResult,
} from "./schemas";

/**
 * The AI call and the verdict for the fruit, trap and label scans (server only).
 * The API routes and `scripts/scan-eval.ts` both use these, so they always behave the same.
 * The leaf scan (gate and leaf model) is not here on purpose.
 */
/** 0 = as repeatable as the model allows. Not a guarantee: the model can still vary a little. */
const SCAN_TEMPERATURE = 0;

export type ScanFlowResult<T> =
  | { ok: true; verdict: Verdict; result: T }
  | { ok: false; reason: string; detail?: string };

type Args = { images: string[]; language?: Language; context?: DiagnoseRequest["context"] };

function contextLine({ language, context }: Pick<Args, "language" | "context">): string {
  return (
    (context ? `\nField context: ${JSON.stringify(context)}` : "") +
    (language ? `\nWrite the "summary" in ${LANGUAGE_NAME[language]}. Keep the enum values (photo, diagnosis) in English exactly as listed.` : "")
  );
}

export async function runFruitScan(args: Args): Promise<ScanFlowResult<FruitResult>> {
  const live = await geminiJsonDetailed({ temperature: SCAN_TEMPERATURE, prompt: FRUIT_PROMPT + contextLine(args), schema: fruitResult, imageBase64List: args.images });
  return live.ok ? { ok: true, verdict: judgeFruit(live.data), result: live.data } : { ok: false, reason: live.reason, detail: live.detail };
}

export async function runTrapScan(args: Args): Promise<ScanFlowResult<TrapResult>> {
  const live = await geminiJsonDetailed({ temperature: SCAN_TEMPERATURE, prompt: TRAP_PROMPT + contextLine(args), schema: trapResult, imageBase64List: args.images });
  return live.ok ? { ok: true, verdict: judgeTrap(live.data), result: live.data } : { ok: false, reason: live.reason, detail: live.detail };
}

export async function runLabelScan(imageBase64: string): Promise<ScanFlowResult<LabelResult>> {
  const live = await geminiJsonDetailed({ temperature: SCAN_TEMPERATURE, prompt: LABEL_PROMPT, schema: labelResult, imageBase64 });
  return live.ok ? { ok: true, verdict: judgeLabel(live.data), result: live.data } : { ok: false, reason: live.reason, detail: live.detail };
}
