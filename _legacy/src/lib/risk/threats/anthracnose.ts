import { RISK_CONFIG as C } from '../config';
import { seasonStage, STAGE_LABEL } from '../season';
import type { AssessInput, Threat } from '../types';
import { finish, mean, pastDays, ramp, sum, trapezoid } from '../util';

const cfg = C.anthracnose;

/**
 * Anthracnose (Colletotrichum): the olive fruit rots. The fungus needs wet, warm conditions and ripe fruit:
 *   score = 100 × wetness × temperature × fruit
 * Only the temperature has a floor. Without ripe fruit, or after a dry week, the score is Low.
 */
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

    const wetness = cfg.wetnessMix.rain * ramp(rain, cfg.rainMm[0], cfg.rainMm[1]) + cfg.wetnessMix.wetHours * ramp(wetHours, 0, cfg.fullWetHours);
    const temperature = cfg.temperatureFloor + (1 - cfg.temperatureFloor) * trapezoid(temp, cfg.temperature);
    const fruit = cfg.fruit[stage];

    const score = 100 * wetness * temperature * fruit;

    const drivers: string[] = [];
    if (fruit > 0 && wetness >= cfg.driverMin) {
      drivers.push(`${Math.round(rain)} mm of rain in the last ${cfg.windowDays} days, fruit wet about ${Math.round(wetHours)} h a day`);
    }
    if (fruit >= cfg.driverMin) drivers.push(`Fruit is ripe or nearly ripe (${STAGE_LABEL[stage]})`);
    if (fruit > 0 && wetness >= cfg.driverMin && temperature >= cfg.driverMin) drivers.push(`Warm weather (${Math.round(temp)} °C) helps the fungus`);

    return finish(input, 'anthracnose', score, drivers, {
      low: ['Keep your normal checks.'],
      medium: ['Remove rotten or shrivelled olives from the trees.', 'Do not leave harvested olives wet.'],
      high: ['Think about harvesting earlier, before more wet weather.', 'Remove rotten or shrivelled olives.', 'Do not leave harvested olives wet.', 'Ask a licensed agronomist if many fruits rot.'],
    });
  },
};
