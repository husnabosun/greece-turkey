import { RISK_CONFIG as C } from '../config';
import type { AssessInput, Threat } from '../types';
import { dayIndexOf, finish, ramp, Scorer } from '../util';

const cfg = C.location;

/** Smallest angle between two compass bearings, 0..180. */
const angleBetween = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Location risk from field data, e.g. ash from a coal power plant that is upwind of the field.
 * The wind counts when it blows FROM the direction of the source.
 */
export const location: Threat = {
  id: 'location',
  name: 'Location risk',
  group: 'location',
  assess(input: AssessInput) {
    const day = input.weather[dayIndexOf(input)];
    let best = { score: 0, drivers: [] as string[] };

    for (const risk of input.signals.locationRisks) {
      const windHours = day.hours.filter(
        (h) => h.windDir !== null && h.gust >= cfg.minGustKmh && angleBetween(h.windDir, risk.bearingDeg) <= cfg.sectorDeg,
      ).length;
      const washed = day.rain >= cfg.washMm;

      const windFactor = ramp(windHours, 0, cfg.fullWindHours);
      // Dry weather only matters when the wind actually carries ash to the field.
      const dryFactor = windFactor * (washed ? cfg.washedFactor : 1);

      const sc = new Scorer()
        .add(cfg.weights.distance, 1 - ramp(risk.km, 0, cfg.maxKm), `A ${risk.label} is ${risk.km} km away`)
        .add(cfg.weights.wind, windFactor, windHours > 0 ? `Wind from the ${risk.label} for about ${windHours} h` : '')
        .add(cfg.weights.dry, dryFactor, windHours > 0 && !washed ? 'Dry day, rain will not wash the ash off' : '');

      if (sc.score > best.score) best = { score: sc.score, drivers: sc.drivers() };
    }

    let score = best.score;
    const drivers = best.drivers;
    if (input.signals.locationRisks.length && input.signals.locationMitigated) {
      score *= cfg.mitigatedKeep;
      drivers.unshift('You marked this as done');
    }

    return finish(
      input,
      'location',
      score,
      input.signals.locationRisks.length ? drivers : ['No known location risks for this field'],
      {
        low: ['No action needed.'],
        medium: ['Wash the olives before delivery.'],
        high: ['Wash the olives before delivery.', 'Order a lab test.', 'Keep harvested olives covered until delivery.'],
      },
    );
  },
};
