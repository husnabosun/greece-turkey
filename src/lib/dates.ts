const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** "12 Oct" for a date `daysAgo` days before `now`. */
export function formatDay(daysAgo = 0, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Timestamp of `hour:minute` local time, `daysAgo` days before `now`. */
export function daysAgoAt(daysAgo: number, hour = 12, minute = 0, now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute).getTime();
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today" or "12 Oct". */
export function dateLabel(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  return sameDay(d, now) ? 'Today' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Today, 09:12" or "12 Oct, 08:40". */
export function whenLabel(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dateLabel(ts, now)}, ${hm}`;
}

/** "YYYY-MM-DD" in local time. */
export function isoDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
