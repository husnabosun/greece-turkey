import { ZodError } from "zod";
import { DEMO_LABEL, geminiJson, LABEL_PROMPT, labelResult, readLabelRequest } from "@/features/diagnostics";
import { euCheck } from "@/features/logbook";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";
import { requireApiUser } from "@/shared/lib/api/require-user";

export const runtime = "nodejs";

/** Gemini label OCR + EU compliance check for the spray logbook draft. */
export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    if (!aiRateLimiter.allow(`label:${auth.userId}`)) {
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
