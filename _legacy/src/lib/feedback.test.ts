import { createFeedback, exportFeedback, exportFeedbackJsonl, findFeedback, upsertFeedback } from './feedback';
import { around, NO_SIGNALS } from './risk/testUtils';
import type { Assessment } from './risk/types';

const weather = around('2026-10-27', { tMean: 16 });
const assessment: Assessment = { threat: 'peacock-spot', day: '2026-10-27', score: 72, level: 'High', drivers: ['3 rainy days'], actions: ['Check the leaves'], confidence: 'High' };

const make = (answer: 'right' | 'wrong', reason?: string, now = 1000) =>
  createFeedback({ fieldId: 'north', assessment, answer, reason, season: 'harvest', weatherSource: 'live', weather, signals: NO_SIGNALS, now });

describe('feedback', () => {
  it('stores the prediction, the weather inputs and the answer', () => {
    const e = make('wrong', '  I checked, no spots ');
    expect(e.id).toBe('north:peacock-spot:2026-10-27');
    expect(e.predicted).toEqual({ score: 72, level: 'High', confidence: 'High' });
    expect(e.reason).toBe('I checked, no spots');
    expect(e.season).toBe('harvest');
    // 14 days before, the day itself, and 2 days after.
    expect(e.weather).toHaveLength(17);
    expect(e.weather[14].date).toBe('2026-10-27');
    expect('hours' in e.weather[0]).toBe(false);
  });

  it('keeps one answer per field, threat and day', () => {
    const first = make('right');
    const second = make('wrong', undefined, 2000);
    const list = upsertFeedback(upsertFeedback([], first), second);
    expect(list).toHaveLength(1);
    expect(list[0].answer).toBe('wrong');
    expect(findFeedback(list, 'north', 'peacock-spot', '2026-10-27')?.answer).toBe('wrong');
    expect(findFeedback(list, 'river', 'peacock-spot', '2026-10-27')).toBeUndefined();
  });

  it('exports rows with a training label', () => {
    const list = upsertFeedback(upsertFeedback([], make('right', undefined, 1000)), { ...make('wrong', 'no spots', 2000), id: 'north:peacock-spot:2026-10-28', day: '2026-10-28' });
    const out = exportFeedback(list, Date.parse('2026-10-30T00:00:00Z'));
    expect(out.format).toBe('agropulse-feedback');
    expect(out.count).toBe(2);
    expect(out.rows.map((r) => r.label)).toEqual([true, false]);
    expect(out.exportedAt).toBe('2026-10-30T00:00:00.000Z');
    expect(JSON.parse(JSON.stringify(out)).rows[0].predicted.score).toBe(72);
  });

  it('exports one JSON object per line', () => {
    const lines = exportFeedbackJsonl([make('right')]).split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).threat).toBe('peacock-spot');
  });
});
