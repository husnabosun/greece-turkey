import { RISK_CONFIG as C } from '../config';
import { seasonStage, STAGE_LABEL } from '../season';
import type { AssessInput, Threat } from '../types';
import { ageDays, clamp, dayIndexOf, finish, latestTrap, mean, pastDays, ramp, recentScans, trapezoid } from '../util';

const cfg = C.oliveFly;
/** Highest score that is still "Medium". */
const MEDIUM_CAP = C.levels.high - 1;

/**
 * Olive fly (Bactrocera oleae): the larva eats the olive fruit.
 *   weatherRisk = temperature × humidity × fruit      (no fruit means no risk)
 * Weather alone can show at most Medium. High needs field evidence:
 *   - a trap with many flies (at least trapMediumFlies × highFliesFactor, or trapMediumFlies when the weather is also High),
 *   - or a recent scan that found an olive fly sting.
 */
export const oliveFly: Threat = {
  id: 'olive-fly',
  name: 'Olive fly',
  group: 'pests',
  assess(input: AssessInput) {
    const day = input.weather[dayIndexOf(input)];
    const stage = seasonStage(input.day);
    const meanTemp = mean(pastDays(input, cfg.temperatureDays).map((d) => d.tMean));
    const humidity = mean(pastDays(input, cfg.humidityDays).map((d) => d.rhMean));

    const temperature = trapezoid(meanTemp, cfg.temperature);
    const humid = ramp(humidity, cfg.humidity[0], cfg.humidity[1]);
    const fruit = cfg.fruit[stage];
    let weatherRisk = temperature * humid * fruit;

    // Very hot, dry days slow the fly down.
    const hot = cfg.heatSuppression;
    const suppressed = day.tMax >= hot.tMaxC && day.rhMean < hot.rhBelow;
    if (suppressed) weatherRisk *= hot.multiplier;

    const weatherScore = 100 * weatherRisk;
    const weatherHigh = weatherRisk >= cfg.weatherHighRisk;

    // Field evidence: the latest trap count and a recent sting scan.
    const trap = latestTrap(input);
    const stings = recentScans(input, C.signals.scanWindowDays).filter((s) => s.title.toLowerCase().includes(C.signals.flyMatch));
    const stingAge = stings.length ? Math.min(...stings.map((s) => ageDays(input, s.ts))) : null;

    let score = weatherScore;
    let highAllowed = false;

    if (trap) {
      const [fromFlies, toFlies] = cfg.trapBoostFlies;
      score += cfg.trapBoost * ramp(trap.flies, fromFlies, toFlies);
      if (trap.flies >= C.signals.trapMediumFlies) score = Math.max(score, C.levels.medium);
      const manyFlies = trap.flies >= C.signals.trapMediumFlies * cfg.highFliesFactor;
      const someFliesAndGoodWeather = weatherHigh && trap.flies >= C.signals.trapMediumFlies;
      if (manyFlies || someFliesAndGoodWeather) {
        highAllowed = true;
        score = Math.max(score, C.levels.high + (100 - C.levels.high) * ramp(trap.flies, C.signals.trapMediumFlies * cfg.highFliesFactor, cfg.highFliesFull));
      }
    }

    if (stingAge !== null) {
      // A sting scan lifts the score, and it fades with the age of the scan.
      score += cfg.stingBoost * (1 - (1 - C.signals.oldScanKeep) * ramp(stingAge, 0, C.signals.scanWindowDays));
      highAllowed = true;
    }

    // Without evidence for High, the level stays at Medium at most.
    if (!highAllowed) score = Math.min(score, MEDIUM_CAP);
    score = clamp(score, 0, 100);

    const drivers: string[] = [];
    if (trap) drivers.push(`Trap count: ${trap.flies} flies${trap.ageDays === 0 ? ' today' : ` ${trap.ageDays} days ago`}`);
    if (stingAge !== null) drivers.push(`Olive fly sting found on a scan ${stingAge === 0 ? 'today' : `${stingAge} days ago`}`);
    if (fruit >= cfg.driverMin) drivers.push(`Olives are on the tree (${STAGE_LABEL[stage]})`);
    if (temperature >= cfg.driverMin) drivers.push(`Mild-warm weather (about ${Math.round(meanTemp)} °C over ${cfg.temperatureDays} days) suits the fly`);
    if (humid >= cfg.driverMin) drivers.push(`Humid air (${Math.round(humidity)} %)`);
    if (suppressed) drivers.push(`Very hot, dry day (${Math.round(day.tMax)} °C) slows the fly`);
    // Weather alone can only show Medium: ask the farmer to confirm with a trap.
    if (!trap && stingAge === null && weatherScore >= C.levels.medium) drivers.unshift('Weather suits the fly – check your traps to confirm');

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
      // Without a trap count this is a weather-only estimate, so we are less sure.
      { confidenceCap: trap ? undefined : 'Medium' },
    );
  },
};
