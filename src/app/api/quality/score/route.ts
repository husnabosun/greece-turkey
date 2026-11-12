import { z, ZodError } from "zod";
import { computeQualityScore, proofWeightFromLevel } from "@/features/quality/score-engine";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  scanHealth: z.number().min(0).max(100),
  healthyTreeShare: z.number().min(0).max(1),
  sprayCount12m: z.number().int().min(0),
  hasBannedSpray: z.boolean(),
  daysSinceLastRecord: z.number().int().min(0).nullable(),
  proofLevel: z.enum(["self_reported", "evidence_based", "lab_verified"]),
  peakRiskScore: z.number().min(0).max(100),
  stage: z.enum(["growing", "almost", "harvested"]),
});

/** Pure quality-score engine exposed for the app / jobs. */
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = computeQualityScore({
      ...body,
      proofWeight: proofWeightFromLevel(body.proofLevel),
    });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("Quality score failed", 500);
  }
}
