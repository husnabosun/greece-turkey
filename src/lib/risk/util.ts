import { rainInWindow, type DayWeather } from '../weather';
import { RISK_CONFIG as C } from './config';
import { LEVEL_RANK, type Assessment, type AssessInput, type Confidence, type RiskLevel, type ThreatId } from './types';

export const DAY_MS = 86_400_000;

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

/** 0 at `from`, 1 at `to`, linear in between (works for from > to too). */
export function ramp(x: number, from: number, to: number): number {
  if (from === to) return x >= to ? 1 : 0;
  return clamp((x - from) / (to - from));
}

/** 0 outside lo..hi, 1 between optLo and optHi, linear on the sides. */
export function trapezoid(x: number, [lo, optLo, optHi, hi]: readonly [number, number, number, number]): number {
  if (x <= lo || x >= hi) return 0;
  if (x < optLo) return (x - lo) / (optLo - lo);
  if (x <= optHi) return 1;
  return (hi - x) / (hi - optHi);
}

export const levelOf = (score: number): RiskLevel => (score >= C.levels.high ? 'High' : score >= C.levels.medium ? 'Medium' : 'Low');
export const maxLevel = (a: RiskLevel, b: RiskLevel): RiskLevel => (LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b);

// ---------- Weather windows ----------

export const dayIndexOf = (input: AssessInput) => Math.max(0, input.weather.findIndex((d) => d.date === input.day));

/** The `n` days ending on (and including) the assessed day. */
export function pastDays(input: AssessInput, n: number): DayWeather[] {
  const i = dayIndexOf(input);
  return input.weather.slice(Math.max(0, i - n + 1), i + 1);
}

/** Days from `before` days earlier to `after` days later than the assessed day. */
export function aroundDay(input: AssessInput, before: number, after: number): DayWeather[] {
  const i = dayIndexOf(input);
  return input.weather.slice(Math.max(0, i - before), i + after + 1);
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Days until the assessed day from today. Negative for the past. */
export const leadDays = (input: AssessInput) => dayIndexOf(input) - input.todayIndex;

/** Midnight (ms) at the start of the assessed day, in the field's local time as seen in the hourly data. */
export function dayStartTs(input: AssessInput): number {
  const day = input.weather[dayIndexOf(input)];
  return day?.hours[0]?.ts ?? Date.parse(`${input.day}T00:00:00Z`);
}

export function confidenceFor(input: AssessInput, cap?: Confidence): Confidence {
  const lead = leadDays(input);
  let c: Confidence = lead <= C.confidence.highUpToLead ? 'High' : lead <= C.confidence.mediumUpToLead ? 'Medium' : 'Low';
  if (input.source === 'demo') c = c === 'High' ? 'Medium' : 'Low';
  if (cap && LEVEL_RANK[cap as RiskLevel] < LEVEL_RANK[c as RiskLevel]) c = cap;
  return c;
}

// ---------- Scoring ----------

interface Factor {
  weight: number;
  value: number;
  text: string;
}

/**
 * Collects weighted factors, then gives the 0..100 score and the drivers sorted by their share.
 * A factor can be marked `{ available: false }` (no trap count, no recent scan): it is left out and
 * the weights of the other factors are scaled up to add up to 1, so missing data does not cap the score.
 */
export class Scorer {
  private factors: Factor[] = [];

  add(weight: number, value: number, text: string, opts: { available?: boolean } = {}) {
    if (opts.available === false) return this;
    this.factors.push({ weight, value: clamp(value), text });
    return this;
  }

  private get totalWeight(): number {
    return sum(this.factors.map((f) => f.weight));
  }

  get score(): number {
    const total = this.totalWeight;
    return total > 0 ? (100 * sum(this.factors.map((f) => f.weight * f.value))) / total : 0;
  }

  /** Reasons whose share of the score is large enough, strongest first. */
  drivers(): string[] {
    const total = this.totalWeight;
    return this.factors
      .filter((f) => f.text && total > 0 && (f.weight * f.value) / total >= C.minDriverContribution)
      .sort((a, b) => b.weight * b.value - a.weight * a.value)
      .map((f) => f.text);
  }
}

// ---------- Spray protection ----------

const dayLabel = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Share of the score removed by approved sprays that target `threat` and are still in their protection window.
 * Rain soon after spraying washes part of it off. Banned products never protect.
 */
export function protection(input: AssessInput, threat: ThreatId): { share: number; note?: string } {
  const at = dayStartTs(input) + DAY_MS / 2;
  let best = 0;
  let note: string | undefined;
  for (const s of input.signals.sprays) {
    if (s.banned || !s.targets.includes(threat) || s.ts > at) continue;
    const age = (at - s.ts) / DAY_MS;
    if (age > s.protectionDays) continue;
    let strength = C.protection.maxStrength * (1 - (1 - C.protection.endStrength) * (age / s.protectionDays));
    const rain = rainInWindow(input.weather, s.ts, C.protection.washoffHours);
    const washed = rain !== null && rain >= C.protection.washoffRainMm;
    if (washed) strength *= C.protection.washoffKeep;
    if (strength > best) {
      best = strength;
      const until = dayLabel(s.ts + s.protectionDays * DAY_MS);
      note = washed
        ? `Spray on ${dayLabel(s.ts)} was partly washed off by rain, protection until ${until}`
        : `Protected by ${s.product.toLowerCase()} from ${dayLabel(s.ts)} (until ${until})`;
    }
  }
  return { share: best, note };
}

// ---------- Scan and trap signals ----------

export function recentScans(input: AssessInput, windowDays: number) {
  const at = dayStartTs(input) + DAY_MS;
  return input.signals.scans.filter((s) => s.ts <= at && at - s.ts <= windowDays * DAY_MS);
}

/** Latest trap count within the trap window, with its age in days. */
export function latestTrap(input: AssessInput): { flies: number; ageDays: number } | null {
  const at = dayStartTs(input) + DAY_MS;
  const traps = input.signals.scans
    .filter((s) => s.mode === 'trap' && s.flies !== undefined && s.ts <= at && at - s.ts <= C.signals.trapWindowDays * DAY_MS)
    .sort((a, b) => b.ts - a.ts);
  if (!traps.length) return null;
  return { flies: traps[0].flies as number, ageDays: Math.round((at - traps[0].ts) / DAY_MS) };
}

/** Age in whole days of a scan or trap, seen from the end of the assessed day. */
export const ageDays = (input: AssessInput, ts: number) => Math.max(0, Math.round((dayStartTs(input) + DAY_MS - ts) / DAY_MS));

// ---------- Result ----------

export function finish(
  input: AssessInput,
  threat: ThreatId,
  rawScore: number,
  drivers: string[],
  actionsByLevel: { low: string[]; medium: string[]; high: string[] },
  opts: { confidenceCap?: Confidence; floor?: number } = {},
): Assessment {
  let score = rawScore;
  const prot = protection(input, threat);
  if (prot.share > 0) {
    score *= 1 - prot.share;
    drivers = [...drivers, prot.note as string];
  }
  if (opts.floor !== undefined) score = Math.max(score, opts.floor);
  score = Math.round(clamp(score, 0, 100));
  const level = levelOf(score);
  const actions = level === 'High' ? actionsByLevel.high : level === 'Medium' ? actionsByLevel.medium : actionsByLevel.low;
  return { threat, day: input.day, score, level, drivers, actions, confidence: confidenceFor(input, opts.confidenceCap) };
}
