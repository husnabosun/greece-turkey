/**
 * "Was this right?" answers, kept as future training data. Pure TS, no UI imports.
 * Each entry stores the prediction, the weather the engine saw, and the field signals,
 * so a model can later be trained on (inputs -> farmer's answer).
 */
import { ENGINE_VERSION } from './risk/config';
import type { Assessment, FieldSignals, SeasonStage } from './risk/types';
import type { DayWeather, WeatherSource } from './weather';

export type FeedbackAnswer = 'right' | 'wrong';

/** One day of weather without the hourly points. */
export type WeatherDaySummary = Omit<DayWeather, 'hours'>;

export interface FeedbackEntry {
  id: string;
  createdAt: number;
  fieldId: string;
  threat: Assessment['threat'];
  /** The day the alert was about, "YYYY-MM-DD". */
  day: string;
  predicted: { score: number; level: Assessment['level']; confidence: Assessment['confidence'] };
  answer: FeedbackAnswer;
  /** Optional reason, e.g. "I checked, no spots". */
  reason?: string;
  engineVersion: string;
  season: SeasonStage;
  weatherSource: WeatherSource;
  /** The 14 days before the assessed day, the day itself and the next 2 days. */
  weather: WeatherDaySummary[];
  signals: FieldSignals;
}

export const WEATHER_DAYS_BEFORE = 14;
export const WEATHER_DAYS_AFTER = 2;

export interface NewFeedback {
  fieldId: string;
  assessment: Assessment;
  answer: FeedbackAnswer;
  reason?: string;
  season: SeasonStage;
  weatherSource: WeatherSource;
  weather: DayWeather[];
  signals: FieldSignals;
  now?: number;
}

function summarise(days: DayWeather[], day: string): WeatherDaySummary[] {
  const i = days.findIndex((d) => d.date === day);
  if (i < 0) return [];
  return days.slice(Math.max(0, i - WEATHER_DAYS_BEFORE), i + WEATHER_DAYS_AFTER + 1).map(({ hours: _hours, ...rest }) => rest);
}

export function createFeedback(n: NewFeedback): FeedbackEntry {
  const createdAt = n.now ?? Date.now();
  const a = n.assessment;
  return {
    id: `${n.fieldId}:${a.threat}:${a.day}`,
    createdAt,
    fieldId: n.fieldId,
    threat: a.threat,
    day: a.day,
    predicted: { score: a.score, level: a.level, confidence: a.confidence },
    answer: n.answer,
    reason: n.reason?.trim() ? n.reason.trim() : undefined,
    engineVersion: ENGINE_VERSION,
    season: n.season,
    weatherSource: n.weatherSource,
    weather: summarise(n.weather, a.day),
    signals: n.signals,
  };
}

/** One answer per field, threat and day: a new answer replaces the old one. */
export function upsertFeedback(entries: FeedbackEntry[], entry: FeedbackEntry): FeedbackEntry[] {
  return [entry, ...entries.filter((e) => e.id !== entry.id)];
}

export const findFeedback = (entries: FeedbackEntry[], fieldId: string, threat: string, day: string) =>
  entries.find((e) => e.id === `${fieldId}:${threat}:${day}`);

export interface FeedbackExport {
  format: 'agropulse-feedback';
  version: 1;
  engineVersion: string;
  exportedAt: string;
  count: number;
  /** Label for training: true when the farmer said the alert was right. */
  rows: (FeedbackEntry & { label: boolean })[];
}

/** All answers in one object that can be saved as JSON and used as training data later. */
export function exportFeedback(entries: FeedbackEntry[], now: number = Date.now()): FeedbackExport {
  return {
    format: 'agropulse-feedback',
    version: 1,
    engineVersion: ENGINE_VERSION,
    exportedAt: new Date(now).toISOString(),
    count: entries.length,
    rows: [...entries].sort((a, b) => a.createdAt - b.createdAt).map((e) => ({ ...e, label: e.answer === 'right' })),
  };
}

/** One JSON object per line, handy for training tools. */
export const exportFeedbackJsonl = (entries: FeedbackEntry[], now?: number) =>
  exportFeedback(entries, now)
    .rows.map((r) => JSON.stringify(r))
    .join('\n');
