import { ZodError } from "zod";
import {
  DEMO_FRUIT,
  DEMO_LEAF,
  DEMO_TRAP,
  diagnoseRequest,
  fruitResult,
  geminiJsonDetailed,
  FRUIT_PROMPT,
  TRAP_PROMPT,
  trapResult,
} from "@/features/diagnostics";
import { predictLeafModel } from "@/features/diagnostics/leaf-space";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";

export const runtime = "nodejs";

function clientKey(request: Request): string {
  return request.headers.get("x-device-id") ?? request.headers.get("x-forwarded-for") ?? "anon";
}

/**
 * Leaf → own TFLite model on Hugging Face Space (no Gemini).
 * Fruit / trap → Gemini with demo fallback (credits permitting).
 */
export async function POST(request: Request) {
  try {
    if (!aiRateLimiter.allow(`diagnose:${clientKey(request)}`)) {
      return jsonError("Rate limit exceeded", 429);
    }

    const body = diagnoseRequest.parse(await request.json());
    const images = body.imageBase64List?.length
      ? body.imageBase64List
      : [body.imageBase64];

    if (body.mode === "leaf") {
      const model = await predictLeafModel(images[0]);
      if (model.ok) {
        return jsonOk({
          mode: "leaf" as const,
          result: model.data,
          source: "model" as const,
          modelVersion: model.modelVersion,
        });
      }
      return jsonOk({
        mode: "leaf" as const,
        result: DEMO_LEAF,
        source: "demo" as const,
        demoReason: model.reason,
        demoDetail: model.detail,
      });
    }

    const contextLine = body.context
      ? `\nField context: ${JSON.stringify(body.context)}`
      : "";

    if (body.mode === "fruit") {
      const live = await geminiJsonDetailed({
        prompt: FRUIT_PROMPT + contextLine,
        schema: fruitResult,
        imageBase64List: images,
      });
      return jsonOk({
        mode: "fruit" as const,
        result: live.ok ? live.data : DEMO_FRUIT,
        source: live.ok ? ("gemini" as const) : ("demo" as const),
        ...(live.ok ? {} : { demoReason: live.reason, demoDetail: live.detail }),
      });
    }

    const live = await geminiJsonDetailed({
      prompt: TRAP_PROMPT + contextLine,
      schema: trapResult,
      imageBase64List: images,
    });
    return jsonOk({
      mode: "trap" as const,
      result: live.ok ? live.data : DEMO_TRAP,
      source: live.ok ? ("gemini" as const) : ("demo" as const),
      ...(live.ok ? {} : { demoReason: live.reason, demoDetail: live.detail }),
    });
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("Diagnosis failed", 500);
  }
}
