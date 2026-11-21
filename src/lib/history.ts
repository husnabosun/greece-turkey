/** Quality score per month for the score history chart. Pure TS, no UI imports. */

export interface MonthScore {
  /** First day of the month, local time. */
  month: Date;
  score: number;
  /** The current month: its score is the live score. */
  current: boolean;
}

/** Months shown in the chart, the current one included. */
export const HISTORY_MONTHS = 6;

/**
 * The last months of a field, oldest first. Earlier months come from `history`, the current month is the live `score`
 * (so finishing a task moves the last point). A new field without history has only the current month.
 */
export function scoreHistory(field: { score: number; history?: number[] }, now: Date = new Date()): MonthScore[] {
  const past = (field.history ?? []).slice(-(HISTORY_MONTHS - 1));
  const all = [...past, field.score];
  return all.map((score, i) => ({
    month: new Date(now.getFullYear(), now.getMonth() - (all.length - 1 - i), 1),
    score,
    current: i === all.length - 1,
  }));
}

/** Change from the first to the last month, in points. */
export function historyChange(points: MonthScore[]): number {
  return points.length < 2 ? 0 : points[points.length - 1].score - points[0].score;
}
