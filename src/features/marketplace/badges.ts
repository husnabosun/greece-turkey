/**
 * Trust badges of a farmer, shown to buyers without the farmer's name.
 * Pure logic: it only needs a few numbers, so it can move to a backend later.
 * Labels/why copy come from next-intl (`processor.badge.*`) via the `t` argument.
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

type BadgeTranslate = (key: string, values?: Record<string, string | number>) => string;

/** The badges the farmer has earned, in a fixed order. */
export function trustBadges(input: BadgeInput, t: BadgeTranslate): Badge[] {
  const out: Badge[] = [];
  if (input.paidDeliveries >= 1 && input.labFailed === 0) {
    out.push({
      id: 'reliable-delivery',
      label: t('badge.reliableDelivery'),
      why:
        input.paidDeliveries === 1
          ? t('badge.reliableDeliveryWhyOnce')
          : t('badge.reliableDeliveryWhyMany', { count: input.paidDeliveries }),
    });
  }
  if (input.records >= RECORDS_COMPLETE_MIN) {
    out.push({
      id: 'complete-records',
      label: t('badge.completeRecords'),
      why: t('badge.completeRecordsWhy', { records: input.records }),
    });
  }
  if (!input.hasBanned) {
    out.push({
      id: 'no-banned',
      label: t('badge.noBanned'),
      why: t('badge.noBannedWhy'),
    });
  }
  return out;
}
