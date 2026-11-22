import { ZodError } from "zod";
import { diagnoseRequest } from "@/features/diagnostics";
import { runFruitScan, runTrapScan } from "@/features/diagnostics/scan-flows";
import { gateOliveLeaf } from "@/features/diagnostics/leaf-gate";
import { predictLeafModel } from "@/features/diagnostics/leaf-space";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";
import { requireApiUser } from "@/shared/lib/api/require-user";
import { checkImageBase64 } from "@/features/diagnostics/image-check";

export const runtime = "nodejs";

/**
 * Leaf → olive-leaf gate (Gemini) then TFLite model on Hugging Face Space.
 * Fruit / trap → Gemini checks the photo and answers (see scan-flows.ts). No demo result: if the AI is down the app says so.
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

    // Fruit and trap: one AI call that also checks the photo. Only a confident, safe answer carries a result.
    const flow = body.mode === "fruit" ? runFruitScan : runTrapScan;
    const run = await flow({ images, language: body.language, context: body.context });
    if (!run.ok) {
      console.warn(`[diagnose] ${body.mode} model unavailable`, run.reason);
      return jsonOk({ mode: body.mode, unavailable: true as const, source: "unavailable" as const, reason: run.reason });
    }
    if (run.verdict.kind !== "ok") {
      return jsonOk({ mode: body.mode, verdict: run.verdict, source: "gemini" as const });
    }
    return jsonOk({ mode: body.mode, result: run.result, verdict: run.verdict, source: "gemini" as const });
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("diagnosis_failed", 500);
  }
}
