/** Pure data shaping for the 6-month quality score history chart (no UI / IO imports). */

export const HISTORY_MONTHS = 6;

export type ScoreRow = { score: number; computedAt: string };

export type MonthPoint = {
  /** 0 = oldest month in the window, HISTORY_MONTHS - 1 = current month. */
  slot: number;
  /** First day of the month, local time. */
  month: Date;
  /** Latest score recorded in that month. */
  score: number;
  /** The newest point: the score shown as "current". */
  current: boolean;
};

export type ScoreHistory = {
  points: MonthPoint[];
  /** Last point minus first point, in points. 0 when there is no usable history. */
  change: number;
  /** Month of the first point (the baseline for `change`); null when < 2 points. */
  since: Date | null;
  /** True when there are at least 2 data points to draw a line. */
  hasHistory: boolean;
};

function monthStart(d: Date, offset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

/** First day of the oldest month in the window (lower bound for the query). */
export function historyWindowStart(now: Date = new Date(), months = HISTORY_MONTHS): Date {
  return monthStart(now, -(months - 1));
}

/**
 * Collapse raw `quality_scores` rows into at most one point per calendar month (the latest score of that
 * month), inside the last `months` months. Months without a score stay empty: nothing is invented.
 */
export function buildScoreHistory(
  rows: ScoreRow[],
  now: Date = new Date(),
  months = HISTORY_MONTHS,
): ScoreHistory {
  const start = historyWindowStart(now, months);
  const latestBySlot = new Map<number, { score: number; time: number }>();

  for (const row of rows) {
    const time = new Date(row.computedAt).getTime();
    const score = Number(row.score);
    if (!Number.isFinite(time) || !Number.isFinite(score)) continue;
    const d = new Date(time);
    const slot = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    if (slot < 0 || slot >= months) continue;
    const prev = latestBySlot.get(slot);
    if (!prev || time > prev.time) {
      latestBySlot.set(slot, { score: Math.max(0, Math.min(100, Math.round(score))), time });
    }
  }

  const slots = [...latestBySlot.keys()].sort((a, b) => a - b);
  const lastSlot = slots[slots.length - 1];
  const points: MonthPoint[] = slots.map((slot) => ({
    slot,
    month: monthStart(start, slot),
    score: latestBySlot.get(slot)!.score,
    current: slot === lastSlot,
  }));

  const hasHistory = points.length >= 2;
  return {
    points,
    change: hasHistory ? points[points.length - 1]!.score - points[0]!.score : 0,
    since: hasHistory ? points[0]!.month : null,
    hasHistory,
  };
}

/** Y axis spans the field's own scores in steps of 10 so a small change stays visible. */
export function scoreAxis(scores: number[]): { lo: number; hi: number; ticks: number[] } {
  if (!scores.length) return { lo: 0, hi: 100, ticks: [0, 50, 100] };
  const lo = Math.max(0, Math.floor((Math.min(...scores) - 4) / 10) * 10);
  const hiRaw = Math.min(100, Math.ceil((Math.max(...scores) + 4) / 10) * 10);
  const hi = Math.max(hiRaw, Math.min(100, lo + 20));
  const adjLo = hi - lo < 20 ? Math.max(0, hi - 20) : lo;
  const ticks: number[] = [];
  for (let v = adjLo; v <= hi; v += 10) ticks.push(v);
  return { lo: adjLo, hi, ticks };
}

// Turkish "from <month>" needs a case suffix that depends on the month name's last vowel / consonant.
const TR_MONTHS_ABLATIVE = [
  "Ocak'tan",
  "Şubat'tan",
  "Mart'tan",
  "Nisan'dan",
  "Mayıs'tan",
  "Haziran'dan",
  "Temmuz'dan",
  "Ağustos'tan",
  "Eylül'den",
  "Ekim'den",
  "Kasım'dan",
  "Aralık'tan",
];

/**
 * Month name for the "since <month>" line. Turkish uses the full name in the ablative ("Haziran'dan bu yana");
 * other languages use the short name from Intl.
 */
export function monthSinceLabel(month: Date, locale: string): string {
  if (locale.startsWith("tr")) return TR_MONTHS_ABLATIVE[month.getMonth()]!;
  return month.toLocaleDateString(locale, { month: "short" });
}
