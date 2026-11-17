/** Default delay when an offer has no delivery timing yet. */
export const DEFAULT_DELIVERY_IN_DAYS = 2;

/** Soft daily mill capacity for overload hints on the week strip (tonnes). */
export const DAY_CAPACITY_TONS = 15;

export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T12:00:00`);
  dt.setDate(dt.getDate() + days);
  return todayIsoDate(dt);
}

export function deliveryInDaysFromIso(isoDate: string, from = todayIsoDate()): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${isoDate}T12:00:00`).getTime();
  const diff = Math.round((b - a) / 86_400_000);
  return Math.max(0, diff);
}

export function nextSevenDays(from = todayIsoDate()): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(from, i));
}

export function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m?.[1] ?? null;
}
