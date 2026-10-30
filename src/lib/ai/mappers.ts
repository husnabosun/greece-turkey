/** Turns AI answers into the shapes the app already uses (scans, spray form, advisor). Pure TypeScript. */
import type { Field, Scan, Spray } from '../../data/mock';
import type { Diagnosis } from '../diagnosis';
import { euCheck, type EuCheck } from '../euCheck';
import { THREAT_BY_ID, type Assessment, type FieldRisk } from '../risk';
import type { FieldWeather } from '../weather';
import type { AdviceResult, AdviseRequest, FruitResult, LabelResult, Language, TrapResult } from './schemas';

/** Below this the AI says the photo was not clear enough. */
export const LOW_CONFIDENCE = 0.4;

const percent = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 100);

export function fruitToDiagnosis(r: FruitResult): Diagnosis {
  const confidence = percent(r.confidence);
  const detail = r.symptoms.length ? r.symptoms.join('. ') + '.' : undefined;
  const base = { confidence, photo: 'fruit' as const, source: 'gemini' as const, detail };
  if (r.confidence < LOW_CONFIDENCE || r.diagnosis === 'unclear') {
    return { ...base, title: 'Not clear', tone: 'watch', pill: 'Retake photo' };
  }
  if (r.diagnosis === 'olive fly sting') return { ...base, title: 'Olive fly sting', latin: 'Bactrocera oleae', tone: 'watch', pill: 'Watch' };
  if (r.diagnosis === 'other damage') return { ...base, title: 'Other damage', tone: 'medium', pill: 'Check it' };
  return { ...base, title: 'Healthy fruit', tone: 'healthy', pill: 'Healthy' };
}

export function trapToDiagnosis(r: TrapResult): Diagnosis {
  const confidence = percent(r.confidence);
  const base = { title: 'Fly trap', confidence, photo: 'trap' as const, flies: r.flyCount, source: 'gemini' as const, detail: r.notes || undefined };
  if (r.confidence < LOW_CONFIDENCE) return { ...base, tone: 'watch', pill: 'Retake photo' };
  if (r.flyCount >= 15) return { ...base, tone: 'high', pill: 'High risk' };
  if (r.flyCount >= 5) return { ...base, tone: 'medium', pill: 'Medium risk' };
  return { ...base, tone: 'healthy', pill: 'Low risk' };
}

/** What the spray form is filled with after reading a label. */
export interface LabelDraft {
  product: string;
  activeSubstances: string[];
  licence?: string;
  dose?: string;
  preHarvestDays?: number;
  crops: string[];
  confidence: number;
  /** Too unsure to trust: the form asks the farmer to check every field. */
  unsure: boolean;
  eu: EuCheck;
}

export function labelToDraft(r: LabelResult): LabelDraft {
  return {
    product: r.productName.trim(),
    activeSubstances: r.activeSubstances,
    licence: r.licenceNumber ?? undefined,
    dose: r.maxDosePerHa ?? undefined,
    preHarvestDays: r.preHarvestDays ?? undefined,
    crops: r.cropsListed,
    confidence: r.confidence,
    unsure: r.confidence < LOW_CONFIDENCE || !r.productName.trim(),
    eu: euCheck(r.activeSubstances),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (ts: number, now: number) => Math.max(0, Math.floor((now - ts) / DAY_MS));

/** Peak assessment of one threat in the next `days` days. */
function peak(list: Assessment[], days: number): Assessment {
  return list.slice(0, days).reduce((b, a) => (a.score > b.score ? a : b));
}

/** The engine's most important risks of the next 3 days (Medium and High; the top one even when Low). */
export function topAssessments(risk: FieldRisk, days = 3, max = 4): Assessment[] {
  const peaks = (Object.values(risk) as Assessment[][]).map((l) => peak(l, days)).sort((a, b) => b.score - a.score);
  const notable = peaks.filter((a) => a.level !== 'Low').slice(0, max);
  return notable.length ? notable : peaks.slice(0, 1);
}

export function buildAdviceRequest(args: {
  language: Language;
  field: Pick<Field, 'id' | 'name' | 'variety' | 'trees' | 'ha'>;
  risk: FieldRisk;
  weather: FieldWeather;
  scans: Scan[];
  sprays: Spray[];
  now: number;
}): AdviseRequest {
  const { field, weather, now } = args;
  const tomorrow = weather.days[weather.todayIndex + 1];
  return {
    language: args.language,
    field: { name: field.name, variety: field.variety, trees: field.trees, ha: field.ha },
    risks: topAssessments(args.risk).map((a) => ({
      threat: THREAT_BY_ID[a.threat].name,
      level: a.level,
      score: Math.round(a.score),
      day: a.day,
      drivers: a.drivers.slice(0, 3).map((d) => d.slice(0, 200)),
    })),
    weather: {
      temperatureC: Math.round(weather.current.temp),
      summary: weather.current.label.slice(0, 200),
      rainTomorrowMm: tomorrow ? Math.round(tomorrow.rain) : undefined,
    },
    recentScans: args.scans
      .filter((s) => s.fieldId === field.id)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5)
      .map((s) => ({ daysAgo: daysAgo(s.ts, now), mode: s.mode, result: s.title.slice(0, 80), flies: s.flies })),
    recentSprays: args.sprays
      .filter((s) => s.fieldId === field.id)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5)
      .map((s) => ({ daysAgo: daysAgo(s.ts, now), product: s.product.slice(0, 80) })),
  };
}

/** The advisor text when the AI is not available: the engine's own words, in English. */
export function fallbackAdvice(risk: FieldRisk, fieldName: string): AdviceResult {
  const a = topAssessments(risk)[0];
  const name = THREAT_BY_ID[a.threat].name;
  const why = a.drivers.find((d) => !/^(Protected by|Spray on)/.test(d)) ?? 'Keep your normal checks.';
  return {
    summary: a.level === 'Low' ? `No big risks for ${fieldName} in the next 3 days.` : `${name} is ${a.level.toLowerCase()} for ${fieldName}.`,
    actions: a.actions.slice(0, 3).length ? a.actions.slice(0, 3) : ['Keep your normal checks.'],
    whyNow: why,
  };
}

/** A short key for the advice cache: same data and language give the same key. */
export function adviceKey(req: AdviseRequest): string {
  const s = JSON.stringify(req);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${req.language}:${req.field.name}:${(h >>> 0).toString(36)}`;
}
