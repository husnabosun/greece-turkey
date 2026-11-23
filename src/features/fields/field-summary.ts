/** Pure helpers for the "no tree selected" field summary card. */

export type RelativeAge = { value: number; unit: "day" | "month" };

/** How long ago an ISO timestamp is, in whole days (under ~2 months) or months. Null for bad input. */
export function relativeAge(iso: string | null | undefined, now: Date = new Date()): RelativeAge | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days < 0) return { value: 0, unit: "day" };
  if (days < 60) return { value: days, unit: "day" };
  return { value: Math.floor(days / 30), unit: "month" };
}

export function formatRelativeAge(age: RelativeAge, locale: string): string {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-age.value, age.unit);
  } catch {
    return `${age.value} ${age.unit}`;
  }
}

/** Tree that most needs attention: diseased first, then suspicious; null when all healthy or none. */
export function pickAttentionTreeId<T extends { id: number; status: string }>(trees: T[]): number | null {
  return (
    trees.find((t) => t.status === "diseased")?.id ?? trees.find((t) => t.status === "suspicious")?.id ?? null
  );
}
