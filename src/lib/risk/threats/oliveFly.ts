import { RISK_CONFIG as C } from '../config';
import { seasonStage, STAGE_LABEL } from '../season';
import type { AssessInput, Threat } from '../types';
import { ageDays, dayIndexOf, finish, latestTrap, mean, pastDays, ramp, recentScans, Scorer, trapezoid } from '../util';

const cfg = C.oliveFly;

/** Olive fly (Bactrocera oleae): the larva eats the olive fruit. Mild-warm, humid weather while fruit is on the tree. */
export const oliveFly: Threat = {
  id: 'olive-fly',
  name: 'Olive fly',
  group: 'pests',
  assess(input: AssessInput) {
    const day = input.weather[dayIndexOf(input)];
    const stage = seasonStage(input.day);
    const humidity = mean(pastDays(input, cfg.humidityDays).map((d) => d.rhMean));

    const temperature = trapezoid(day.tMean, cfg.temperature);
    const humid = ramp(humidity, cfg.humidity[0], cfg.humidity[1]);
    const fruit = cfg.fruit[stage];

    const trap = latestTrap(input);
    const [fromFlies, toFlies] = C.signals.trapRampFlies;
    const trapFactor = trap ? ramp(trap.flies, fromFlies, toFlies) : 0;

    // A scan that found an olive fly sting on fruit.
    const stings = recentScans(input, C.signals.scanWindowDays).filter((s) => s.title.toLowerCase().includes(C.signals.flyMatch));
    const stingAge = stings.length ? Math.min(...stings.map((s) => ageDays(input, s.ts))) : null;
    const stingFactor = stingAge === null ? 0 : 1 - (1 - C.signals.oldScanKeep) * ramp(stingAge, 0, C.signals.scanWindowDays);

    const sc = new Scorer()
      .add(cfg.weights.temperature, temperature, `Mild-warm weather (${Math.round(day.tMean)} °C) suits the fly`)
      .add(cfg.weights.humidity, humid, `Humid air (${Math.round(humidity)} %)`)
      .add(cfg.weights.fruit, fruit, fruit > 0 ? `Olives are on the tree (${STAGE_LABEL[stage]})` : 'There is little fruit on the trees now')
      .add(cfg.weights.trap, trapFactor, trap ? `Trap count: ${trap.flies} flies${trap.ageDays === 0 ? ' today' : ` ${trap.ageDays} days ago`}` : '')
      .add(cfg.weights.fruitScan, stingFactor, stingAge === null ? '' : `Olive fly sting found on a scan ${stingAge === 0 ? 'today' : `${stingAge} days ago`}`);

    let score = sc.score;
    const drivers = sc.drivers();
    const hot = cfg.heatSuppression;
    if (day.tMax >= hot.tMaxC && day.rhMean < hot.rhBelow) {
      score *= hot.multiplier;
      drivers.push(`Very hot, dry day (${Math.round(day.tMax)} °C) slows the fly`);
    }

    const floor = trap && trap.flies > C.signals.trapMediumFlies ? C.levels.medium : undefined;

    return finish(
      input,
      'olive-fly',
      score,
      drivers,
      {
        low: ['Keep your normal checks.'],
        medium: ['Check your yellow traps every 2 days.', 'Pick up fallen olives.'],
        high: ['Check your yellow traps every 2 days.', 'Pick up fallen olives and look for stung fruit.', 'Think about harvesting earlier.', 'Ask a licensed agronomist about control.'],
      },
      { floor },
    );
  },
};
