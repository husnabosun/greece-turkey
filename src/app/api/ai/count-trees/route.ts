import { ZodError } from "zod";
import { countTreesFromSatellite } from "@/features/fields/count-trees-from-satellite";
import { countTreesRequest } from "@/features/fields/count-trees-schema";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";
import { requireApiUser } from "@/shared/lib/api/require-user";

export const runtime = "nodejs";

/** Count olive-tree crowns inside a drawn field polygon from Esri satellite + Gemini. */
export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    if (!aiRateLimiter.allow(`count-trees:${auth.userId}`)) {
      return jsonError("rate_limited", 429);
    }

    const body = countTreesRequest.parse(await request.json());
    const result = await countTreesFromSatellite(body.polygon);

    if (!result.ok) {
      return jsonOk({
        unavailable: true as const,
        reason: result.reason,
        detail: result.detail,
      });
    }

    return jsonOk({
      treeCount: result.treeCount,
      confidence: result.confidence,
      source: result.source,
      tiles: result.tiles,
      rawCount: result.rawCount,
      adjusted: result.adjusted,
    });
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    console.warn("[count-trees]", err instanceof Error ? err.message : err);
    return jsonError("count_trees_failed", 500);
  }
}
