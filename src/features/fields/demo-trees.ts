import type { MapTree, MapTreeStatus } from "@/features/fields/field-health-map";

/** Demo tree dots matching the Expo prototype (North grove layout, includes #23). */
const NORTH: [number, number, MapTreeStatus][] = [
  [12, 22, "healthy"],
  [33, 27, "healthy"],
  [53, 16, "healthy"],
  [70, 27, "healthy"],
  [22, 40, "suspicious"],
  [35, 58, "healthy"],
  [45, 37, "suspicious"],
  [76, 38, "healthy"],
  [16, 58, "suspicious"],
  [30, 72, "healthy"],
  [52, 63, "suspicious"],
  [73, 62, "suspicious"],
  [47, 79, "healthy"],
  [86, 66, "healthy"],
  [18, 79, "healthy"],
];

export const DEMO_FIELD_TREES: MapTree[] = [
  ...NORTH.slice(0, 8).map(([x, y, status], i) => ({ id: 3 + i, x, y, status })),
  {
    id: 23,
    x: 50,
    y: 54,
    status: "diseased",
    issue: "peacock-spot",
  },
  ...NORTH.slice(8).map(([x, y, status], i) => ({ id: 30 + i, x, y, status })),
  { id: 12, x: 71, y: 26, status: "diseased", issue: "peacock-spot" },
  { id: 41, x: 25, y: 84, status: "diseased", issue: "peacock-spot" },
];

/** Tree that most needs attention (diseased, then suspicious); null when all healthy. */
export function pickDefaultTreeId(trees: MapTree[]): number | null {
  return (
    trees.find((t) => t.status === "diseased")?.id ?? trees.find((t) => t.status === "suspicious")?.id ?? null
  );
}
