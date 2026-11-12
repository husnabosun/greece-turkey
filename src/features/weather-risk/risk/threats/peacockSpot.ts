import { RISK_CONFIG as C } from '../config';
import { seasonStage, STAGE_LABEL } from '../season';
import type { AssessInput, Threat } from '../types';
import { ageDays, finish, mean, pastDays, ramp, recentScans, trapezoid } from '../util';

const cfg = C.peacockSpot;

/** A factor that modulates but never dominates: it stays between `floor` and 1. */
const soften = (x: number) => cfg.multiplierFloor + (1 - cfg.multiplierFloor) * x;

/**
 * Peacock spot (Spilocaea oleaginea): round spots on the leaves.
 * The fungus infects only when the leaves are wet, so wetness is the main factor and the others multiply it:
 *   score = 100 × wetness × temperature × season, plus a small boost from a recent scan that found it.
 */
export const peacockSpot: Threat = {
  id: 'peacock-spot',
  name: 'Peacock spot',
  group: 'pests',
  assess(input: AssessInput) {
    const w = pastDays(input, cfg.windowDays);
    const rainyDays = w.filter((d) => d.rain >= cfg.rainyDayMm).length;
    const wetHours = mean(w.map((d) => d.wetHours));
    const temp = mean(w.map((d) => d.tMean));
    const stage = seasonStage(input.day);

    const wetness = cfg.wetnessMix.rainyDays * ramp(rainyDays, 0, cfg.fullRainyDays) + cfg.wetnessMix.wetHours * ramp(wetHours, 0, cfg.fullWetHours);
    const temperature = soften(trapezoid(temp, cfg.temperature));
    const season = soften(cfg.season[stage]);

    // A recent peacock spot scan means there are spores on the leaves already. It can only raise the score.
    const scans = recentScans(input, C.signals.scanWindowDays).filter((s) => s.title.toLowerCase().includes(C.signals.peacockMatch));
    let inoculum = 0;
    let scanAge = 0;
    for (const s of scans) {
      const age = ageDays(input, s.ts);
      const severity = s.tone === 'high' ? cfg.severity.high : s.tone === 'medium' ? cfg.severity.medium : cfg.severity.other;
      const value = severity * (1 - (1 - C.signals.oldScanKeep) * ramp(age, 0, C.signals.scanWindowDays));
      if (value > inoculum) {
        inoculum = value;
        scanAge = age;
      }
    }

    const score = 100 * wetness * temperature * season + cfg.inoculumBoost * inoculum;

    const drivers: string[] = [];
    if (wetness >= cfg.driverMin) {
      drivers.push(
        rainyDays > 0
          ? `${rainyDays} rainy day${rainyDays === 1 ? '' : 's'} in the last ${cfg.windowDays} days, leaves wet about ${Math.round(wetHours)} h a day`
          : `Leaves wet about ${Math.round(wetHours)} h a day`,
      );
    }
    if (inoculum > 0) drivers.push(`Peacock spot found on a scan ${scanAge === 0 ? 'today' : `${scanAge} days ago`}`);
    if (wetness >= cfg.driverMin && temperature >= cfg.driverMin) drivers.push(`Mild temperature (${Math.round(temp)} °C) suits the fungus`);
    if (wetness >= cfg.driverMin && season >= cfg.driverMin) drivers.push(`Peacock spot is likely in the ${STAGE_LABEL[stage]} season`);

    return finish(input, 'peacock-spot', score, drivers, {
      low: ['Keep your normal checks.'],
      medium: ['Check the leaves for round spots after the next rain.', 'Prune for airflow so the leaves dry faster.'],
      high: ['Check the leaves for round spots now, especially after rain.', 'Prune for airflow and remove fallen leaves.', 'Ask a licensed agronomist if you see spots on many trees.'],
    });
  },
};
