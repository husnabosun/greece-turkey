import { z } from "zod";
import type { FieldPolygon } from "@/features/fields/satellite-style";

const ringPoint = z.tuple([z.number(), z.number()]);

export const countTreesRequest = z.object({
  polygon: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(ringPoint).min(4)).min(1),
  }),
});

export type CountTreesRequest = z.infer<typeof countTreesRequest>;

/** Gemini tile answer — prefer `count`; accept legacy `treeCount`. */
export const treeCountAiResult = z
  .object({
    count: z.number().int().min(0).max(8000).optional(),
    treeCount: z.number().int().min(0).max(8000).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .transform((raw) => {
    const count = raw.count ?? raw.treeCount ?? 0;
    return {
      count,
      confidence: raw.confidence ?? 0.7,
    };
  });

export type TreeCountAiResult = z.infer<typeof treeCountAiResult>;

export function isFieldPolygon(value: unknown): value is FieldPolygon {
  const parsed = countTreesRequest.shape.polygon.safeParse(value);
  return parsed.success;
}
