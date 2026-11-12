import type { PillTone } from '@/components/ui';
import type { Breakdown } from '@/data/mock';

/** The four factors of the quality score, in the order the Quality score screen shows them. */
export const BREAKDOWN_ROWS: { key: keyof Breakdown; title: string; hint: string }[] = [
  { key: 'tree', title: 'Tree health', hint: 'Leaf condition and disease status' },
  { key: 'spray', title: 'Safe spraying', hint: 'Recent spray choice and safety compliance' },
  { key: 'harvest', title: 'Harvest timing', hint: 'Timing suitability for harvest' },
  { key: 'records', title: 'Records kept', hint: 'Spray and field records are complete' },
];

export function breakdownStatus(value: number): { label: string; tone: PillTone } {
  if (value >= 90) return { label: 'Excellent', tone: 'good' };
  if (value >= 80) return { label: 'Very good', tone: 'good' };
  if (value >= 60) return { label: 'Good', tone: 'good' };
  return { label: 'Needs improvement', tone: 'warn' };
}
