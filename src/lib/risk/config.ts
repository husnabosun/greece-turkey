/**
 * All thresholds and weights of the risk engine.
 *
 * STARTING HEURISTICS, TO BE VALIDATED BY AN AGRONOMIST AND CALIBRATED WITH FIELD DATA.
 * They are plausible for Aegean olive groves, not measured. Change numbers here, never in the logic.
 *
 * Every threat score is the weighted sum of factors that are each 0..1. Weights of one threat add up to 1,
 * so the score is 0..100. "ramp(x, a, b)" is 0 at a, 1 at b, linear in between.
 * "trapezoid(x, lo, optLo, optHi, hi)" is 0 below lo and above hi, 1 between optLo and optHi.
 */
import type { SeasonStage } from './types';

export const ENGINE_VERSION = 'rules-0.1';

export const RISK_CONFIG = {
  /** Score needed for each level. */
  levels: { medium: 35, high: 65 },

  /** A factor is listed as a driver when it adds at least this much (0..1 of the score). */
  minDriverContribution: 0.05,

  /** How many days ahead the weather is still reliable. Day 0 is today. */
  confidence: { highUpToLead: 0, mediumUpToLead: 3 },

  /** An approved spray lowers the score of the threats it targets during its protection window. */
  protection: {
    /** Share of the score removed right after spraying. */
    maxStrength: 0.5,
    /** At the end of the window the protection has faded to this share of maxStrength. */
    endStrength: 0.4,
    /** Rain (mm) within the wash-off hours that washes the spray off. */
    washoffRainMm: 5,
    washoffHours: 24,
    /** Share of the protection that is left after a wash-off. */
    washoffKeep: 0.3,
  },

  /** How old scans and traps may be to count. */
  signals: {
    scanWindowDays: 30,
    trapWindowDays: 14,
    /** A trap with more flies than this makes olive fly at least Medium. */
    trapMediumFlies: 10,
    /** Trap count at which the trap factor starts and reaches 1. */
    trapRampFlies: [3, 25] as const,
    /** Words in a scan diagnosis (lower case) that count as these threats. */
    /** An old scan counts at least this share of a new one (it fades linearly over the scan window). */
    oldScanKeep: 0.5,
    peacockMatch: 'peacock spot',
    flyMatch: 'olive fly',
  },

  /** Peacock spot (Spilocaea oleaginea): wet, mild weather, mainly autumn to spring. */
  peacockSpot: {
    weights: { wetness: 0.45, temperature: 0.25, season: 0.15, inoculum: 0.15 },
    /** Wetness is half rainy days, half wet-leaf hours. */
    wetnessMix: { rainyDays: 0.5, wetHours: 0.5 },
    /** A day with at least this much rain (mm) is a rainy day. */
    rainyDayMm: 1,
    windowDays: 7,
    /** Rainy days in the window for a full score, and mean wet-leaf hours per day for a full score. */
    fullRainyDays: 4,
    fullWetHours: 10,
    /** Mean temperature (°C): trapezoid lo, optLo, optHi, hi. */
    temperature: [5, 12, 20, 27] as const,
    season: { dormant: 1, flowering: 0.5, 'fruit-set': 0.15, 'pit-hardening': 0.05, ripening: 0.35, harvest: 1 } as Record<SeasonStage, number>,
    /** A peacock spot scan counts for this long, and its weight by severity. */
    severity: { high: 1, medium: 0.6, other: 0.4 },
  },

  /** Olive fly (Bactrocera oleae): attacks the fruit; likes mild, humid weather. */
  oliveFly: {
    weights: { temperature: 0.25, humidity: 0.15, fruit: 0.25, trap: 0.25, fruitScan: 0.1 },
    temperature: [10, 18, 28, 35] as const,
    /** Mean relative humidity (%) for no and for full effect, averaged over the last 3 days. */
    humidity: [45, 70] as const,
    humidityDays: 3,
    /** How much fruit is on the tree, by stage. */
    fruit: { dormant: 0, flowering: 0, 'fruit-set': 0.3, 'pit-hardening': 0.5, ripening: 1, harvest: 0.8 } as Record<SeasonStage, number>,
    /** Very hot and dry days suppress the fly: the score is multiplied. */
    heatSuppression: { tMaxC: 35, rhBelow: 45, multiplier: 0.4 },
  },

  /** Olive moth (Prays oleae): flowering, fruit set and leaf generations; likes mild weather. */
  oliveMoth: {
    /** The weather decides how strong the attack is; the stage decides how much of it can happen. */
    weights: { temperature: 0.6, humidity: 0.4 },
    humidityDays: 3,
    /** At or above this stage factor the stage is listed as a driver. */
    stageDriverMin: 0.5,
    stage: { dormant: 0.35, flowering: 1, 'fruit-set': 0.9, 'pit-hardening': 0.3, ripening: 0.2, harvest: 0.4 } as Record<SeasonStage, number>,
    temperature: [8, 14, 24, 32] as const,
    humidity: [50, 75] as const,
  },

  /** Anthracnose (Colletotrichum): fruit rot in a warm, rainy autumn near harvest. */
  anthracnose: {
    weights: { rain: 0.3, wetness: 0.2, temperature: 0.25, season: 0.25 },
    windowDays: 7,
    /** Rain (mm) in the window for no and for full effect. */
    rainMm: [5, 40] as const,
    fullWetHours: 10,
    temperature: [8, 15, 25, 32] as const,
    season: { dormant: 0, flowering: 0, 'fruit-set': 0.1, 'pit-hardening': 0.1, ripening: 0.7, harvest: 1 } as Record<SeasonStage, number>,
  },

  /** Olive knot (Pseudomonas savastanoi): bacteria enter wounds; rain, hail or frost after pruning or leaf fall. */
  oliveKnot: {
    weights: { wounds: 0.5, wet: 0.35, temperature: 0.15 },
    /** A pruning cut is a fresh wound for this many days. */
    pruningWoundDays: 14,
    /** Wound level during harvest (leaf fall and beating the trees). */
    leafFallWound: 0.25,
    /** Wound level after hail-like wind or frost in the last 3 days. */
    stormWound: 0.8,
    stormWindowDays: 3,
    /** Rain (mm) from the day before to 2 days after, for no and for full effect. */
    rainMm: [2, 15] as const,
    rainDaysBefore: 1,
    rainDaysAfter: 2,
    temperature: [0, 8, 24, 30] as const,
    /** Below this wound level there is no wound, and the score cannot go above noWoundCap. */
    minWound: 0.05,
    noWoundCap: 10,
  },

  /** Weather hazards. */
  frost: {
    /** A minimum below this (°C) is frost. */
    thresholdC: 0,
    /** Colder than this is the worst case. */
    hardC: -4,
    /** Between threshold and this (°C) there is a small risk of frost. */
    nearC: 2,
    nearMaxScore: 40,
    /** Score right at the frost threshold. */
    baseScore: 50,
  },
  heat: {
    thresholdC: 38,
    nearC: 34,
    nearMaxScore: 40,
    baseScore: 50,
    /** Hotter than threshold by this many degrees is the worst case. */
    extremeOver: 6,
  },
  wind: {
    /** Gusts (km/h) above this are strong wind or hail weather. */
    thresholdKmh: 60,
    nearKmh: 40,
    nearMaxScore: 40,
    baseScore: 50,
    extremeOver: 40,
    /** Heavy rain (mm per day) with gusts above nearKmh may bring hail. */
    hailRainMm: 10,
    hailBoost: 15,
  },
  drought: {
    /** Days without rain that count as drought. We only see about 3 weeks, so confidence stays Low. */
    fullDays: 30,
    startDays: 7,
    /** A day with less rain (mm) than this is dry. */
    dryDayMm: 1,
    /** Mean maximum temperature (°C) over the last 7 days. */
    heatC: [28, 36] as const,
    weights: { dry: 0.6, heat: 0.4 },
  },

  /** Location risk (e.g. ash from a coal power plant). */
  location: {
    /** Distance (km) at which the source stops mattering. */
    maxKm: 15,
    /** Wind counts when it blows from within this many degrees of the source. */
    sectorDeg: 45,
    /** Gusts (km/h) needed to carry ash. */
    minGustKmh: 15,
    /** Hours per day with the right wind for a full wind factor. */
    fullWindHours: 8,
    /** Rain washes ash off: a day with at least this much rain (mm) counts as washed. */
    washMm: 2,
    washedFactor: 0.3,
    weights: { distance: 0.3, wind: 0.5, dry: 0.2 },
    /** Share of the score left after the farmer marked it done. */
    mitigatedKeep: 0.3,
  },
} as const;
