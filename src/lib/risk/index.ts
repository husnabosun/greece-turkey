import type { FieldWeather } from '../weather';
import { anthracnose } from './threats/anthracnose';
import { location } from './threats/location';
import { oliveFly } from './threats/oliveFly';
import { oliveKnot } from './threats/oliveKnot';
import { oliveMoth } from './threats/oliveMoth';
import { peacockSpot } from './threats/peacockSpot';
import { drought, frost, heat, wind } from './threats/weatherHazards';
import { LEVEL_RANK, type Assessment, type FieldSignals, type RiskLevel, type Threat, type ThreatGroup, type ThreatId } from './types';

export * from './types';
export { ENGINE_VERSION, RISK_CONFIG } from './config';
export { seasonStage, STAGE_LABEL } from './season';
export { buildSignals } from './signals';

/** The threats we assess. A trained model can replace one entry: it only has to implement `Threat`. */
export const THREATS: Threat[] = [peacockSpot, oliveFly, oliveMoth, anthracnose, oliveKnot, frost, heat, wind, drought, location];

export const THREAT_BY_ID = Object.fromEntries(THREATS.map((t) => [t.id, t])) as Record<ThreatId, Threat>;
export const threatsInGroup = (group: ThreatGroup) => THREATS.filter((t) => t.group === group);

/** Result of one field: for every threat, the assessment of each day from today. */
export type FieldRisk = Record<ThreatId, Assessment[]>;

/**
 * Assesses all threats for `days` days starting today.
 * Pass `threats` to try another implementation (for example a trained model).
 */
export function assessField(w: FieldWeather, signals: FieldSignals, now: number, days = 7, threats: Threat[] = THREATS): FieldRisk {
  const out = {} as FieldRisk;
  const dates = w.days.slice(w.todayIndex, w.todayIndex + days).map((d) => d.date);
  for (const t of threats) {
    out[t.id] = dates.map((day) => t.assess({ day, weather: w.days, todayIndex: w.todayIndex, source: w.source, now, signals }));
  }
  return out;
}

export const higher = (a: Assessment, b: Assessment) => (b.score > a.score ? b : a);

/** The assessment with the highest score among `threats` within the first `days` days. */
export function highestRisk(risk: FieldRisk, days = 3, filter?: (id: ThreatId) => boolean): Assessment | null {
  let best: Assessment | null = null;
  for (const [id, list] of Object.entries(risk) as [ThreatId, Assessment[]][]) {
    if (filter && !filter(id)) continue;
    for (const a of list.slice(0, days)) best = best ? higher(best, a) : a;
  }
  return best;
}

export const levelAtLeast = (a: RiskLevel, min: RiskLevel) => LEVEL_RANK[a] >= LEVEL_RANK[min];
