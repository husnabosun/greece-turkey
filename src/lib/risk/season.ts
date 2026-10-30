import type { SeasonStage } from './types';

/**
 * Season stage from the date, for the Aegean (northern hemisphere).
 * Starting heuristics: [month, day] where each stage starts. Dormant also covers the spring leaf growth.
 */
const STAGE_STARTS: { stage: SeasonStage; month: number; day: number }[] = [
  // The harvest runs from 15 October over the new year to 31 January, so it also starts the calendar year.
  { stage: 'harvest', month: 1, day: 1 },
  { stage: 'dormant', month: 2, day: 1 },
  { stage: 'flowering', month: 4, day: 20 },
  { stage: 'fruit-set', month: 6, day: 10 },
  { stage: 'pit-hardening', month: 7, day: 10 },
  { stage: 'ripening', month: 8, day: 15 },
  { stage: 'harvest', month: 10, day: 15 },
];

export const STAGE_LABEL: Record<SeasonStage, string> = {
  dormant: 'winter rest',
  flowering: 'flowering',
  'fruit-set': 'fruit set',
  'pit-hardening': 'pit hardening',
  ripening: 'ripening',
  harvest: 'harvest',
};

/** Accepts "YYYY-MM-DD" or a Date. */
export function seasonStage(date: string | Date): SeasonStage {
  const [m, d] = typeof date === 'string' ? [Number(date.slice(5, 7)), Number(date.slice(8, 10))] : [date.getMonth() + 1, date.getDate()];
  let stage: SeasonStage = 'dormant';
  for (const s of STAGE_STARTS) {
    if (m > s.month || (m === s.month && d >= s.day)) stage = s.stage;
  }
  return stage;
}
