/** Calls the app's real risk engine for one day, exactly like the app does, without field signals. */
import { THREATS } from '../../src/lib/risk';
import type { Assessment, FieldSignals } from '../../src/lib/risk';
import type { DayWeather } from '../../src/lib/weather';

const NO_SIGNALS: FieldSignals = { scans: [], sprays: [], locationRisks: [], locationMitigated: false };

/** `window` is the sliding window of days, `todayIndex` the position of `day` in it. */
export function assessThreats(window: DayWeather[], todayIndex: number, day: string, now: number): Assessment[] {
  return THREATS.map((t) => t.assess({ day, weather: window, todayIndex, source: 'live', now, signals: NO_SIGNALS }));
}
