import { RISK_CONFIG as C } from '../config';
import type { AssessInput, Threat } from '../types';
import { dayIndexOf, finish, mean, pastDays, ramp, Scorer } from '../util';

/** Frost (minimum below 0 °C): damages shoots, flowers and fruit. */
export const frost: Threat = {
  id: 'frost',
  name: 'Frost',
  group: 'weather',
  assess(input: AssessInput) {
    const cfg = C.frost;
    const { tMin } = input.weather[dayIndexOf(input)];
    let score = 0;
    const drivers: string[] = [];
    if (tMin < cfg.thresholdC) {
      score = cfg.baseScore + (100 - cfg.baseScore) * ramp(cfg.thresholdC - tMin, 0, cfg.thresholdC - cfg.hardC);
      drivers.push(`Night minimum ${Math.round(tMin * 10) / 10} °C, below freezing`);
    } else if (tMin < cfg.nearC) {
      score = cfg.nearMaxScore * ramp(cfg.nearC - tMin, 0, cfg.nearC - cfg.thresholdC);
      drivers.push(`Night minimum ${Math.round(tMin * 10) / 10} °C, close to freezing`);
    }
    return finish(input, 'frost', score, drivers, {
      low: ['No action needed.'],
      medium: ['Do not prune before the cold night.', 'Check young shoots after the cold.'],
      high: ['Do not prune before the cold night.', 'Harvest ripe olives before the frost if you can.', 'Check young shoots and fruit after the frost.'],
    });
  },
};

/** Heat stress (maximum above 38 °C): trees close their leaves and fruit can dry out. */
export const heat: Threat = {
  id: 'heat',
  name: 'Heat stress',
  group: 'weather',
  assess(input: AssessInput) {
    const cfg = C.heat;
    const { tMax } = input.weather[dayIndexOf(input)];
    let score = 0;
    const drivers: string[] = [];
    if (tMax > cfg.thresholdC) {
      score = cfg.baseScore + (100 - cfg.baseScore) * ramp(tMax - cfg.thresholdC, 0, cfg.extremeOver);
      drivers.push(`Daytime maximum ${Math.round(tMax)} °C`);
    } else if (tMax > cfg.nearC) {
      score = cfg.nearMaxScore * ramp(tMax - cfg.nearC, 0, cfg.thresholdC - cfg.nearC);
      drivers.push(`Daytime maximum ${Math.round(tMax)} °C, getting very hot`);
    }
    return finish(input, 'heat', score, drivers, {
      low: ['No action needed.'],
      medium: ['Water young trees early in the morning if you can.'],
      high: ['Water young trees early in the morning if you can.', 'Avoid pruning and heavy work in the hottest hours.', 'Keep harvested olives in the shade.'],
    });
  },
};

/** Strong wind or hail (gusts above 60 km/h). */
export const wind: Threat = {
  id: 'wind',
  name: 'Strong wind',
  group: 'weather',
  assess(input: AssessInput) {
    const cfg = C.wind;
    const day = input.weather[dayIndexOf(input)];
    let score = 0;
    const drivers: string[] = [];
    if (day.maxGust > cfg.thresholdKmh) {
      score = cfg.baseScore + (100 - cfg.baseScore) * ramp(day.maxGust - cfg.thresholdKmh, 0, cfg.extremeOver);
      drivers.push(`Gusts up to ${Math.round(day.maxGust)} km/h`);
    } else if (day.maxGust > cfg.nearKmh) {
      score = cfg.nearMaxScore * ramp(day.maxGust - cfg.nearKmh, 0, cfg.thresholdKmh - cfg.nearKmh);
      drivers.push(`Gusts up to ${Math.round(day.maxGust)} km/h`);
    }
    if (day.maxGust > cfg.nearKmh && day.rain >= cfg.hailRainMm) {
      score += cfg.hailBoost;
      drivers.push(`Heavy rain (${Math.round(day.rain)} mm) with wind, hail is possible`);
    }
    return finish(input, 'wind', score, drivers, {
      low: ['No action needed.'],
      medium: ['Pick up broken branches after the wind.'],
      high: ['Harvest ripe olives before the wind if you can.', 'Check the trees for broken branches and wounds afterwards.'],
    });
  },
};

/**
 * Drought: many days without rain, with heat. We only see about 3 weeks of weather, so we cannot
 * see the full 30 days. The score still grows with the dry days we can see, and confidence stays Low.
 */
export const drought: Threat = {
  id: 'drought',
  name: 'Drought',
  group: 'weather',
  assess(input: AssessInput) {
    const cfg = C.drought;
    const i = dayIndexOf(input);
    let streak = 0;
    for (let k = i; k >= 0 && input.weather[k].rain < cfg.dryDayMm; k--) streak++;
    const heatC = mean(pastDays(input, 7).map((d) => d.tMax));

    const sc = new Scorer()
      .add(cfg.weights.dry, ramp(streak, cfg.startDays, cfg.fullDays), `${streak} dry day${streak === 1 ? '' : 's'} in a row`)
      .add(cfg.weights.heat, ramp(heatC, cfg.heatC[0], cfg.heatC[1]), `Hot days (about ${Math.round(heatC)} °C)`);

    return finish(
      input,
      'drought',
      sc.score,
      sc.drivers(),
      {
        low: ['No action needed.'],
        medium: ['Water young trees if you can.', 'Spread mulch around the trunks.'],
        high: ['Water young trees if you can.', 'Spread mulch around the trunks.', 'Avoid heavy pruning until it rains.'],
      },
      { confidenceCap: 'Low' },
    );
  },
};
