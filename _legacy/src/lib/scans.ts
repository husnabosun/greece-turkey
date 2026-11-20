/** List helpers for scans. Pure TS, no UI imports. */
import type { Scan } from '@/data/mock';

export type Trend = 'improving' | 'worse' | 'same';

export interface BeforeAfter {
  fieldId: string;
  treeId: number;
  before: Scan;
  after: Scan;
  trend: Trend;
}

const treeKey = (s: Pick<Scan, 'fieldId' | 'treeId'>) => `${s.fieldId}:${s.treeId}`;

/** Trees with 2 or more leaf scans: the oldest and the newest scan, newest tree first. */
export function beforeAfter(scans: Scan[]): BeforeAfter[] {
  const byTree = new Map<string, Scan[]>();
  for (const s of scans) {
    if (s.mode !== 'leaf' || !s.treeId) continue;
    byTree.set(treeKey(s), [...(byTree.get(treeKey(s)) ?? []), s]);
  }
  const out: BeforeAfter[] = [];
  for (const list of byTree.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.ts - b.ts);
    const before = sorted[0];
    const after = sorted[sorted.length - 1];
    const b = before.spots ?? 0;
    const a = after.spots ?? 0;
    out.push({ fieldId: before.fieldId, treeId: before.treeId!, before, after, trend: a < b ? 'improving' : a > b ? 'worse' : 'same' });
  }
  return out.sort((x, y) => y.after.ts - x.after.ts);
}

/** A scan is due for a re-check until a newer scan of the same tree exists. */
export function isDue(scan: Scan, all: Scan[]): boolean {
  if (!scan.recheckDue) return false;
  return !all.some((s) => s.id !== scan.id && s.fieldId === scan.fieldId && s.treeId === scan.treeId && s.ts > scan.ts);
}

export interface ScanGroup {
  fieldId: string;
  scans: Scan[];
}

/**
 * Scans for the list: filtered by field, without the scans shown in a before/after card,
 * newest first inside each field. Group order: the field of the scan saved last, then fields with
 * a re-check due, then the rest by newest scan.
 */
export function groupScans(scans: Scan[], fieldFilter: string | 'all', onlyDue = false, topScanId?: string): ScanGroup[] {
  const inCards = new Set<string>();
  for (const c of beforeAfter(scans)) {
    for (const s of scans) if (s.mode === 'leaf' && treeKey(s) === treeKey({ fieldId: c.fieldId, treeId: c.treeId })) inCards.add(s.id);
  }
  const list = scans
    .filter((s) => !inCards.has(s.id))
    .filter((s) => fieldFilter === 'all' || s.fieldId === fieldFilter)
    .filter((s) => !onlyDue || isDue(s, scans))
    .sort((a, b) => b.ts - a.ts);

  const groups = new Map<string, Scan[]>();
  for (const s of list) groups.set(s.fieldId, [...(groups.get(s.fieldId) ?? []), s]);
  const rank = (g: ScanGroup) => (g.scans.some((s) => s.id === topScanId) ? 0 : g.scans.some((s) => isDue(s, scans)) ? 1 : 2);
  return [...groups.entries()]
    .map(([fieldId, items]) => ({ fieldId, scans: items }))
    .sort((a, b) => rank(a) - rank(b) || b.scans[0].ts - a.scans[0].ts);
}

/** Timestamp for a new scan: now, but always newer than every existing scan. */
export function nextTimestamp(scans: Scan[], now = Date.now()): number {
  return Math.max(now, ...scans.map((s) => s.ts + 1));
}
