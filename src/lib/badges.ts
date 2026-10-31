/**
 * Trust badges of a farmer, shown to buyers without the farmer's name.
 * Pure logic: it only needs a few numbers, so it can move to a backend later.
 */

export type BadgeId = 'reliable-delivery' | 'complete-records' | 'no-banned';

export interface Badge {
  id: BadgeId;
  label: string;
  /** One short line: why the farmer has it. */
  why: string;
}

/** Records factor of the quality score (0-100) from which the records count as complete. */
export const RECORDS_COMPLETE_MIN = 80;

export interface BadgeInput {
  /** The "Records kept" factor of the quality score, 0-100. */
  records: number;
  /** A banned product was used on the lot. */
  hasBanned: boolean;
  /** Deliveries of this farmer that were paid, and how many of them failed the lab check. */
  paidDeliveries: number;
  labFailed: number;
}

/** The badges the farmer has earned, in a fixed order. */
export function trustBadges(input: BadgeInput): Badge[] {
  const out: Badge[] = [];
  if (input.paidDeliveries >= 1 && input.labFailed === 0) {
    out.push({
      id: 'reliable-delivery',
      label: 'Reliable delivery',
      why: input.paidDeliveries === 1 ? 'Delivered and paid once, lab check passed.' : `Delivered and paid ${input.paidDeliveries} times, lab checks passed.`,
    });
  }
  if (input.records >= RECORDS_COMPLETE_MIN) {
    out.push({ id: 'complete-records', label: 'Complete records', why: `Spray and field records are complete (${input.records}%).` });
  }
  if (!input.hasBanned) {
    out.push({ id: 'no-banned', label: 'No banned products', why: 'No product that is not approved in the EU.' });
  }
  return out;
}
