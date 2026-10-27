import type { DayWeather, WeatherSource } from '../weather';

export type ThreatId =
  | 'peacock-spot'
  | 'olive-fly'
  | 'olive-moth'
  | 'anthracnose'
  | 'olive-knot'
  | 'frost'
  | 'heat'
  | 'wind'
  | 'drought'
  | 'location';

export type RiskLevel = 'Low' | 'Medium' | 'High';
export type Confidence = 'Low' | 'Medium' | 'High';
export type SeasonStage = 'dormant' | 'flowering' | 'fruit-set' | 'pit-hardening' | 'ripening' | 'harvest';
export type ThreatGroup = 'pests' | 'weather' | 'location';

export interface Assessment {
  threat: ThreatId;
  /** Local date, "YYYY-MM-DD". */
  day: string;
  /** 0–100. */
  score: number;
  level: RiskLevel;
  /** Plain-English reasons, strongest first. */
  drivers: string[];
  /** Non-chemical actions first. Never a pesticide or a dose. */
  actions: string[];
  confidence: Confidence;
}

export interface ScanSignal {
  ts: number;
  mode: 'leaf' | 'fruit' | 'trap' | 'label';
  title: string;
  tone: string;
  spots?: number;
  flies?: number;
}

export interface SpraySignal {
  ts: number;
  product: string;
  /** Threats this spray protects against. */
  targets: ThreatId[];
  protectionDays: number;
  banned: boolean;
}

export interface LocationSignal {
  kind: 'coal-plant';
  label: string;
  km: number;
  /** Compass bearing from the field to the source (0 = north). */
  bearingDeg: number;
}

/** What we know about one field besides the weather. */
export interface FieldSignals {
  scans: ScanSignal[];
  sprays: SpraySignal[];
  prunedDaysAgo?: number;
  locationRisks: LocationSignal[];
  /** The farmer marked the location risk as done (e.g. washed the olives). */
  locationMitigated: boolean;
}

export interface AssessInput {
  /** Day to assess, "YYYY-MM-DD". Must be one of `weather[].date`. */
  day: string;
  /** 14 past days, today and the coming days. */
  weather: DayWeather[];
  /** Index of today in `weather`. */
  todayIndex: number;
  /** Where the weather came from. Demo data lowers the confidence. */
  source: WeatherSource;
  /** Current time in milliseconds. */
  now: number;
  signals: FieldSignals;
}

/** One threat. A trained model can later implement this same interface. */
export interface Threat {
  id: ThreatId;
  name: string;
  group: ThreatGroup;
  assess(input: AssessInput): Assessment;
}

export const LEVEL_RANK: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2 };
