import { RISK_CONFIG as C } from '../config';
import { seasonStage } from '../season';
import type { AssessInput, Threat } from '../types';
import { aroundDay, dayIndexOf, finish, pastDays, ramp, sum, Scorer, trapezoid } from '../util';

const cfg = C.oliveKnot;

/** Olive knot (Pseudomonas savastanoi): bacteria enter wounds. Rain, hail or frost soon after pruning or leaf fall. */
export const oliveKnot: Threat = {
  id: 'olive-knot',
  name: 'Olive knot',
  group: 'pests',
  assess(input: AssessInput) {
    const day = input.weather[dayIndexOf(input)];
    const stage = seasonStage(input.day);
    const lead = dayIndexOf(input) - input.todayIndex;

    // Wounds: a fresh pruning cut, leaf fall at harvest, or damage from hail-like wind or frost in the last days.
    const pruneAge = input.signals.prunedDaysAgo === undefined ? undefined : input.signals.prunedDaysAgo + Math.max(0, lead);
    const pruning = pruneAge === undefined || pruneAge < 0 ? 0 : 1 - ramp(pruneAge, 0, cfg.pruningWoundDays);
    const leafFall = stage === 'harvest' ? cfg.leafFallWound : 0;
    const recent = pastDays(input, cfg.stormWindowDays);
    const storm = recent.some((d) => d.maxGust > C.wind.thresholdKmh || d.tMin < C.frost.thresholdC) ? cfg.stormWound : 0;
    const wounds = Math.max(pruning, leafFall, storm);

    const around = aroundDay(input, cfg.rainDaysBefore, cfg.rainDaysAfter);
    const rain = sum(around.map((d) => d.rain));

    const woundText =
      wounds === pruning && pruning > 0
        ? `Pruned ${pruneAge} days ago, cuts are still open`
        : wounds === storm && storm > 0
          ? 'Hail-like wind or frost in the last days can wound the bark'
          : 'Leaf fall and harvest leave small wounds';

    const sc = new Scorer()
      .add(cfg.weights.wounds, wounds, woundText)
      .add(cfg.weights.wet, ramp(rain, cfg.rainMm[0], cfg.rainMm[1]), `${Math.round(rain)} mm of rain around this day`)
      .add(cfg.weights.temperature, trapezoid(day.tMean, cfg.temperature), `Mild temperature (${Math.round(day.tMean)} °C)`);

    // Without any wound the bacteria cannot get in.
    const raw = wounds < cfg.minWound ? Math.min(sc.score, cfg.noWoundCap) : sc.score;

    return finish(input, 'olive-knot', raw, sc.drivers(), {
      low: ['Keep your normal checks.'],
      medium: ['Do not prune before rain or frost.', 'Clean your pruning tools between trees.'],
      high: ['Do not prune before rain or frost.', 'Clean your pruning tools between trees.', 'Look at fresh cuts for rough galls.', 'Ask a licensed agronomist about protecting wounds.'],
    });
  },
};
