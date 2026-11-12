import { ZodError } from "zod";
import { DEMO_LABEL, geminiJson, LABEL_PROMPT, labelResult, readLabelRequest } from "@/features/diagnostics";
import { euCheck } from "@/features/logbook";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";

export const runtime = "nodejs";

function clientKey(request: Request): string {
  return request.headers.get("x-device-id") ?? request.headers.get("x-forwarded-for") ?? "anon";
}

/** Gemini label OCR + EU compliance check for the spray logbook draft. */
export async function POST(request: Request) {
  try {
    if (!aiRateLimiter.allow(`label:${clientKey(request)}`)) {
      return jsonError("Rate limit exceeded", 429);
    }

    const body = readLabelRequest.parse(await request.json());
    const live = await geminiJson({
      prompt: LABEL_PROMPT,
      schema: labelResult,
      imageBase64: body.imageBase64,
    });

    const label = live ?? DEMO_LABEL;
    const compliance = euCheck(label.activeSubstances);

    return jsonOk({
      label,
      eu: compliance,
      source: live ? ("gemini" as const) : ("demo" as const),
    });
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("Label read failed", 500);
  }
}
