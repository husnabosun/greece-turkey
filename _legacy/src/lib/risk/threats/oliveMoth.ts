import { RISK_CONFIG as C } from '../config';
import { seasonStage, STAGE_LABEL } from '../season';
import type { AssessInput, Threat } from '../types';
import { dayIndexOf, finish, mean, pastDays, ramp, Scorer, trapezoid } from '../util';

const cfg = C.oliveMoth;

/** Olive moth (Prays oleae): larvae eat flowers, young fruit and leaves. Linked to flowering, fruit set and leaf generations. */
export const oliveMoth: Threat = {
  id: 'olive-moth',
  name: 'Olive moth',
  group: 'pests',
  assess(input: AssessInput) {
    const day = input.weather[dayIndexOf(input)];
    const stage = seasonStage(input.day);
    const humidity = mean(pastDays(input, cfg.humidityDays).map((d) => d.rhMean));

    const stageFactor = cfg.stage[stage];
    const sc = new Scorer()
      .add(cfg.weights.temperature, trapezoid(day.tMean, cfg.temperature), `Mild weather (${Math.round(day.tMean)} °C) favours the moth`)
      .add(cfg.weights.humidity, ramp(humidity, cfg.humidity[0], cfg.humidity[1]), `Humid air (${Math.round(humidity)} %)`);
    const drivers = sc.drivers();
    drivers.unshift(
      stageFactor >= cfg.stageDriverMin ? `The moth is active in the ${STAGE_LABEL[stage]} stage` : `Moth activity is low in the ${STAGE_LABEL[stage]} stage`,
    );

    return finish(input, 'olive-moth', sc.score * stageFactor, drivers, {
      low: ['Keep your normal checks.'],
      medium: ['Look at flowers and young fruit for tiny larvae.', 'Remove damaged leaves or fruit.'],
      high: ['Look at flowers and young fruit for tiny larvae.', 'Remove damaged leaves or fruit.', 'Ask a licensed agronomist about the right time to act.'],
    });
  },
};
