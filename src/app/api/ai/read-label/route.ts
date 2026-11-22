import { ZodError } from "zod";
import { readLabelRequest } from "@/features/diagnostics";
import { runLabelScan } from "@/features/diagnostics/scan-flows";
import { euCheck } from "@/features/logbook";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";
import { requireApiUser } from "@/shared/lib/api/require-user";

export const runtime = "nodejs";

/**
 * Label OCR + EU compliance check for the spray logbook draft.
 * Only a confident read carries a label. A bad photo gives a retake reason, and an AI outage says so:
 * the form is never filled from a made-up label.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    if (!aiRateLimiter.allow(`label:${auth.userId}`)) {
      return jsonError("Rate limit exceeded", 429);
    }

    const body = readLabelRequest.parse(await request.json());
    const run = await runLabelScan(body.imageBase64);
    if (!run.ok) {
      console.warn("[read-label] model unavailable", run.reason);
      return jsonOk({ unavailable: true as const, source: "unavailable" as const, reason: run.reason });
    }
    if (run.verdict.kind !== "ok") {
      return jsonOk({ verdict: run.verdict, source: "gemini" as const });
    }
    return jsonOk({
      verdict: run.verdict,
      label: run.result,
      eu: euCheck(run.result.activeSubstances),
      source: "gemini" as const,
    });
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("Label read failed", 500);
  }
}
