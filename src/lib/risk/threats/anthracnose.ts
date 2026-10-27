import { RISK_CONFIG as C } from '../config';
import { seasonStage, STAGE_LABEL } from '../season';
import type { AssessInput, Threat } from '../types';
import { finish, mean, pastDays, ramp, sum, Scorer, trapezoid } from '../util';

const cfg = C.anthracnose;

/** Anthracnose (Colletotrichum): the olive fruit rots. Warm, rainy autumn near harvest. */
export const anthracnose: Threat = {
  id: 'anthracnose',
  name: 'Anthracnose',
  group: 'pests',
  assess(input: AssessInput) {
    const w = pastDays(input, cfg.windowDays);
    const rain = sum(w.map((d) => d.rain));
    const wetHours = mean(w.map((d) => d.wetHours));
    const temp = mean(w.map((d) => d.tMean));
    const stage = seasonStage(input.day);

    const sc = new Scorer()
      .add(cfg.weights.rain, ramp(rain, cfg.rainMm[0], cfg.rainMm[1]), `${Math.round(rain)} mm of rain in the last ${cfg.windowDays} days`)
      .add(cfg.weights.wetness, ramp(wetHours, 0, cfg.fullWetHours), `Fruit stays wet about ${Math.round(wetHours)} h a day`)
      .add(cfg.weights.temperature, trapezoid(temp, cfg.temperature), `Warm weather (${Math.round(temp)} °C) helps the fungus`)
      .add(cfg.weights.season, cfg.season[stage], `Fruit is ripe or nearly ripe (${STAGE_LABEL[stage]})`);

    return finish(input, 'anthracnose', sc.score, sc.drivers(), {
      low: ['Keep your normal checks.'],
      medium: ['Remove rotten or shrivelled olives from the trees.', 'Do not leave harvested olives wet.'],
      high: ['Think about harvesting earlier, before more wet weather.', 'Remove rotten or shrivelled olives.', 'Do not leave harvested olives wet.', 'Ask a licensed agronomist if many fruits rot.'],
    });
  },
};
