import { ZodError } from "zod";
import {
  diagnoseRequest,
  fruitResult,
  geminiJsonDetailed,
  FRUIT_PROMPT,
  TRAP_PROMPT,
  trapResult,
} from "@/features/diagnostics";
import { gateOliveLeaf } from "@/features/diagnostics/leaf-gate";
import { predictLeafModel } from "@/features/diagnostics/leaf-space";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";
import { requireApiUser } from "@/shared/lib/api/require-user";
import { checkImageBase64 } from "@/features/diagnostics/image-check";

export const runtime = "nodejs";

/**
 * Leaf → olive-leaf gate (Gemini) then TFLite model on Hugging Face Space.
 * Fruit / trap → Gemini with demo fallback (credits permitting).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    if (!aiRateLimiter.allow(`diagnose:${auth.userId}`)) {
      return jsonError("rate_limited", 429);
    }

    const body = diagnoseRequest.parse(await request.json());
    const images = body.imageBase64List?.length
      ? body.imageBase64List
      : [body.imageBase64];

    // Reject corrupt / tiny / panorama files before spending any AI quota.
    for (const img of images) {
      const check = checkImageBase64(img);
      if (!check.ok) return jsonError(check.code, 400);
    }

    if (body.mode === "leaf") {
      const gate = await gateOliveLeaf(images[0]);
      if (gate.ok && !gate.pass) {
        return jsonOk({
          mode: "leaf" as const,
          rejected: "not_leaf" as const,
          gate: gate.data,
          source: "gate" as const,
        });
      }

      const model = await predictLeafModel(images[0]);
      if (model.ok) {
        return jsonOk({
          mode: "leaf" as const,
          result: model.data,
          source: "model" as const,
          modelVersion: model.modelVersion,
        });
      }
      // Model unavailable (quota / timeout): never return a made-up diagnosis.
      console.warn("[diagnose] leaf model unavailable", model.reason);
      return jsonOk({
        mode: "leaf" as const,
        unavailable: true as const,
        source: "unavailable" as const,
        reason: model.reason,
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
      if (!live.ok) {
        console.warn("[diagnose] fruit model unavailable", live.reason);
        return jsonOk({ mode: "fruit" as const, unavailable: true as const, source: "unavailable" as const, reason: live.reason });
      }
      return jsonOk({ mode: "fruit" as const, result: live.data, source: "gemini" as const });
    }

    const live = await geminiJsonDetailed({
      prompt: TRAP_PROMPT + contextLine,
      schema: trapResult,
      imageBase64List: images,
    });
    if (!live.ok) {
      console.warn("[diagnose] trap model unavailable", live.reason);
      return jsonOk({ mode: "trap" as const, unavailable: true as const, source: "unavailable" as const, reason: live.reason });
    }
    return jsonOk({ mode: "trap" as const, result: live.data, source: "gemini" as const });
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("diagnosis_failed", 500);
  }
}
