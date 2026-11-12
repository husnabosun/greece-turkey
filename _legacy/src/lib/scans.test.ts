import { initialScans } from '@/data/mock';
import { beforeAfter, groupScans, isDue, nextTimestamp } from './scans';
import { diagnose, scanTitle } from './diagnosis';

describe('scans', () => {
  it('builds a before/after card for a tree with two scans', () => {
    const [card] = beforeAfter(initialScans);
    expect(card.treeId).toBe(23);
    expect(card.before.spots).toBe(4);
    expect(card.after.spots).toBe(1);
    expect(card.trend).toBe('improving');
  });

  it('keeps scans from the card out of the list and groups by field', () => {
    const groups = groupScans(initialScans, 'all');
    expect(groups.map((g) => g.fieldId)).toEqual(['north', 'river']);
    expect(groups[0].scans.map((s) => s.treeId)).toEqual([41, 12]);
  });

  it('shows the field of the scan saved last first', () => {
    const saved = { ...initialScans[4], id: 'new', ts: 9e15 };
    expect(groupScans([...initialScans, saved], 'all', false, 'new')[0].fieldId).toBe('river');
  });

  it('filters by field', () => {
    expect(groupScans(initialScans, 'river')).toHaveLength(1);
    expect(groupScans(initialScans, 'hill')).toHaveLength(0);
  });

  it('marks a scan as due until a newer scan of the same tree exists', () => {
    const due = initialScans.find((s) => s.id === 'sc3')!;
    expect(isDue(due, initialScans)).toBe(true);
    const newer = { ...due, id: 'new', ts: due.ts + 1, recheckDue: false };
    expect(isDue(due, [...initialScans, newer])).toBe(false);
  });

  it('puts a new scan on top even if the clock is behind', () => {
    expect(nextTimestamp(initialScans, 0)).toBeGreaterThan(Math.max(...initialScans.map((s) => s.ts)));
  });

  it('makes a re-check look better than the scan before it', () => {
    expect(diagnose('leaf', { previousSpots: 3 }).spots).toBe(1);
    expect(diagnose('leaf', { previousSpots: 1 }).spots).toBe(1);
  });

  it('names scans for the list', () => {
    expect(scanTitle({ mode: 'trap', title: 'Fly trap', flies: 14 })).toBe('Fly trap · 14 flies');
    expect(scanTitle({ mode: 'leaf', title: 'Peacock spot', treeId: 41 })).toBe('Tree #41 · Peacock spot');
  });
});
