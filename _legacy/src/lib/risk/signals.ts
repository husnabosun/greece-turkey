import type { Field, Scan, Spray } from '../../data/mock';
import type { FieldSignals } from './types';

/** Collects what we know about one field from its scans, sprays and field data. */
export function buildSignals(field: Field, scans: Scan[], sprays: Spray[], locationMitigated = false): FieldSignals {
  return {
    scans: scans
      .filter((s) => s.fieldId === field.id)
      .map((s) => ({ ts: s.ts, mode: s.mode, title: s.title, tone: s.tone, spots: s.spots, flies: s.flies })),
    sprays: sprays
      .filter((s) => s.fieldId === field.id)
      .map((s) => ({ ts: s.ts, product: s.product, targets: s.targets ?? [], protectionDays: s.protectionDays ?? 0, banned: s.banned })),
    prunedDaysAgo: field.prunedDaysAgo,
    locationRisks: field.locationRisks ?? [],
    locationMitigated,
  };
}
