import { useMemo } from 'react';
import { colors } from '@/theme/tokens';
import { assessField, highestRisk, LEVEL_RANK, THREAT_BY_ID, type Assessment, type FieldRisk, type RiskLevel, type ThreatId } from '@/lib/risk';
import { buildSignals } from '@/lib/risk/signals';
import { demoWeather, type FieldWeather, type WeatherSource } from '@/lib/weather';
import { useStore } from './store';

export type WeatherStatus = WeatherSource | 'loading';

export interface FieldRiskView {
  fieldId: string;
  weather: FieldWeather;
  status: WeatherStatus;
  risk: FieldRisk;
}

/**
 * Risk of every field, from its weather (live, cached or demo) and its scans, sprays and location data.
 * Until the first weather load finishes, demo weather is used and the status is "loading".
 */
export function useRisk(): Record<string, FieldRiskView> {
  const fields = useStore((s) => s.fields);
  const weather = useStore((s) => s.weather);
  const scans = useStore((s) => s.scans);
  const sprays = useStore((s) => s.sprays);
  const mitigated = useStore((s) => s.locationRiskDone);

  return useMemo(() => {
    const now = Date.now();
    const out: Record<string, FieldRiskView> = {};
    for (const f of fields) {
      const loaded = weather[f.id];
      const w = loaded ?? demoWeather({ id: f.id, lat: f.lat, lon: f.lon }, now);
      // The location risk "mark as done" button belongs to the Hill field.
      const signals = buildSignals(f, scans, sprays, f.id === 'hill' && mitigated);
      out[f.id] = { fieldId: f.id, weather: w, status: loaded ? loaded.source : 'loading', risk: assessField(w, signals, now) };
    }
    return out;
  }, [fields, weather, scans, sprays, mitigated]);
}

export const LEVEL_COLOR: Record<RiskLevel, string> = { High: colors.risk, Medium: colors.warn, Low: colors.good };

/** Highest score today, over all threats of a field. Drives the field colours. */
export function currentRisk(view: FieldRiskView | undefined): Assessment | null {
  return view ? highestRisk(view.risk, 1) : null;
}

export function useFieldColor(fieldId: string): string {
  const risk = useRisk()[fieldId];
  const a = currentRisk(risk);
  return a ? LEVEL_COLOR[a.level] : colors.good;
}

/** Colours of all fields in one go, for lists of chips. */
export function useFieldColors(): Record<string, string> {
  const risk = useRisk();
  return useMemo(() => Object.fromEntries(Object.entries(risk).map(([id, v]) => [id, LEVEL_COLOR[currentRisk(v)?.level ?? 'Low']])), [risk]);
}

/** The most serious pest or disease of a field in the next days, for the field card. */
export function topPest(view: FieldRiskView | undefined, days = 3): Assessment | null {
  return view ? highestRisk(view.risk, days, (id) => THREAT_BY_ID[id].group === 'pests') : null;
}

/** Number of different threats that reach High in at least one field within the next `days` days. */
export function countRisks(all: Record<string, FieldRiskView>, days = 3): number {
  const high = new Set<ThreatId>();
  for (const v of Object.values(all)) {
    for (const [id, list] of Object.entries(v.risk) as [ThreatId, Assessment[]][]) {
      if (list.slice(0, days).some((a) => LEVEL_RANK[a.level] >= LEVEL_RANK.High)) high.add(id);
    }
  }
  return high.size;
}

/** Highest risk of all fields in the next `days` days, with the field it belongs to. */
export function topRiskOfAll(all: Record<string, FieldRiskView>, days = 3): { fieldId: string; assessment: Assessment } | null {
  let best: { fieldId: string; assessment: Assessment } | null = null;
  for (const v of Object.values(all)) {
    const a = highestRisk(v.risk, days);
    if (a && (!best || a.score > best.assessment.score)) best = { fieldId: v.fieldId, assessment: a };
  }
  return best;
}

export type { ThreatId };
