import { ZodError } from "zod";
import {
  DEMO_FRUIT,
  DEMO_LEAF,
  DEMO_TRAP,
  diagnoseRequest,
  fruitResult,
  geminiJson,
  leafResult,
  FRUIT_PROMPT,
  LEAF_PROMPT,
  TRAP_PROMPT,
  trapResult,
} from "@/features/diagnostics";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";

export const runtime = "nodejs";

function clientKey(request: Request): string {
  return request.headers.get("x-device-id") ?? request.headers.get("x-forwarded-for") ?? "anon";
}

/** Gemini 2.5 Flash multimodal leaf / fruit / trap diagnosis. */
export async function POST(request: Request) {
  try {
    if (!aiRateLimiter.allow(`diagnose:${clientKey(request)}`)) {
      return jsonError("Rate limit exceeded", 429);
    }

    const body = diagnoseRequest.parse(await request.json());
    const contextLine = body.context
      ? `\nField context: ${JSON.stringify(body.context)}`
      : "";

    if (body.mode === "leaf") {
      const live = await geminiJson({
        prompt: LEAF_PROMPT + contextLine,
        schema: leafResult,
        imageBase64: body.imageBase64,
      });
      return jsonOk({
        mode: "leaf" as const,
        result: live ?? DEMO_LEAF,
        source: live ? ("gemini" as const) : ("demo" as const),
      });
    }

    if (body.mode === "fruit") {
      const live = await geminiJson({
        prompt: FRUIT_PROMPT + contextLine,
        schema: fruitResult,
        imageBase64: body.imageBase64,
      });
      return jsonOk({
        mode: "fruit" as const,
        result: live ?? DEMO_FRUIT,
        source: live ? ("gemini" as const) : ("demo" as const),
      });
    }

    const live = await geminiJson({
      prompt: TRAP_PROMPT + contextLine,
      schema: trapResult,
      imageBase64: body.imageBase64,
    });
    return jsonOk({
      mode: "trap" as const,
      result: live ?? DEMO_TRAP,
      source: live ? ("gemini" as const) : ("demo" as const),
    });
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("Diagnosis failed", 500);
  }
}
