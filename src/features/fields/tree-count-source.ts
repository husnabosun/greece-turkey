/**
 * Where a field's tree count came from. Stored inside the existing `fields.notes` JSON text
 * (key `tree_count_source`), so no database schema change is needed.
 */
export type TreeCountSource = "satellite" | "density" | "farmer";

export const TREE_COUNT_SOURCES: readonly TreeCountSource[] = ["satellite", "density", "farmer"];

const KEY = "tree_count_source";

function isSource(v: unknown): v is TreeCountSource {
  return typeof v === "string" && (TREE_COUNT_SOURCES as readonly string[]).includes(v);
}

function parseNotes(notes: string | null | undefined): Record<string, unknown> {
  if (!notes || !notes.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    /* plain-text legacy note: kept below under legacy_note */
  }
  return { legacy_note: notes };
}

/** The recorded source, or null for fields created before this was tracked. */
export function parseTreeCountSource(notes: string | null | undefined): TreeCountSource | null {
  const v = parseNotes(notes)[KEY];
  return isSource(v) ? v : null;
}

/** `notes` with the source set. Every other key in the JSON is kept; plain text is kept as `legacy_note`. */
export function withTreeCountSource(notes: string | null | undefined, source: TreeCountSource): string {
  return JSON.stringify({ ...parseNotes(notes), [KEY]: source });
}

/** What to record for a new field: the farmer's own number wins, then the satellite count, then the density guess. */
export function sourceForNewField(input: {
  farmerEdited: boolean;
  hasSatelliteCount: boolean;
  hasDensityEstimate: boolean;
}): TreeCountSource | null {
  if (input.farmerEdited) return "farmer";
  if (input.hasSatelliteCount) return "satellite";
  if (input.hasDensityEstimate) return "density";
  return null;
}

/** A number the farmer confirmed is never replaced by a satellite or density estimate. */
export function canOverwriteTreeCount(source: TreeCountSource | null): boolean {
  return source !== "farmer";
}

/**
 * Source to store when a count is saved from the edit form: a changed number becomes "farmer";
 * an unchanged number keeps whatever it was.
 */
export function sourceAfterEdit(
  previousCount: number | null,
  nextCount: number | null,
  previousSource: TreeCountSource | null,
): TreeCountSource | null {
  if (nextCount == null) return previousSource;
  if (nextCount !== previousCount) return "farmer";
  return previousSource;
}

/** Message key (namespace `farmerFields`) for the label of a source. */
export const TREE_SOURCE_MESSAGE_KEY = {
  satellite: "treeSourceSatellite",
  density: "treeSourceDensity",
  farmer: "treeSourceFarmer",
} as const satisfies Record<TreeCountSource, string>;
