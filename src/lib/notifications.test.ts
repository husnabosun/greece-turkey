import { historyChange, scoreHistory } from './history';
import { translate } from './i18n';
import { harvestReminders, offerNotification } from './notifications';

const field = (id: string, ready: boolean, badge: string) => ({ id, name: id, harvest: { ready, badge } });

describe('harvestReminders', () => {
  it('reminds for fields ready now or within 3 days, and opens a listing for that field', () => {
    const list = harvestReminders([field('river', true, 'Now'), field('soon', false, '3 days'), field('north', false, '12 days')]);
    expect(list.map((n) => n.id)).toEqual(['harvest-river', 'harvest-soon']);
    expect(list[0].title).toBe('river is ready to harvest');
    expect(list[1].title).toBe('soon is ready to harvest in 3 days');
    expect(list[0].href).toBe('/farmer/market/new?fieldId=river');
  });

  it('is empty when no harvest is close', () => {
    expect(harvestReminders([field('north', false, '12 days')])).toEqual([]);
  });

  it('is translated through the templates', () => {
    expect(translate('tr', harvestReminders([field('Hill', false, '2 days')])[0].title)).toBe('Hill 2 gün sonra hasada hazır');
  });
});

describe('offerNotification', () => {
  it('names the price, the factory, the tons and the field, and opens Offers', () => {
    const n = offerNotification({ id: 'o9', pricePerKg: 0.95, tons: 2.5 }, 'Demo Olive Oil Co.', 'River plot');
    expect(n.title).toBe('New offer: €0.95/kg');
    expect(n.body).toBe('Demo Olive Oil Co. wants 2.5 t from River plot. Tap to see it.');
    expect(n.href).toBe('/farmer/market/offers');
    expect(translate('el', n.title)).toBe('Νέα προσφορά: €0.95/kg');
  });
});

describe('scoreHistory', () => {
  const now = new Date(2026, 10, 17);

  it('ends with the live score in the current month', () => {
    const points = scoreHistory({ score: 68, history: [74, 78, 80, 79, 77] }, now);
    expect(points.map((p) => p.score)).toEqual([74, 78, 80, 79, 77, 68]);
    expect(points.map((p) => p.month.getMonth())).toEqual([5, 6, 7, 8, 9, 10]);
    expect(points[5].current).toBe(true);
    expect(historyChange(points)).toBe(-6);
  });

  it('keeps only the last 6 months, also across a new year', () => {
    const points = scoreHistory({ score: 90, history: [1, 2, 3, 4, 5, 6, 7] }, new Date(2026, 1, 3));
    expect(points.map((p) => p.score)).toEqual([3, 4, 5, 6, 7, 90]);
    expect(points[0].month).toEqual(new Date(2025, 8, 1));
  });

  it('has only the current month for a new field', () => {
    const points = scoreHistory({ score: 70 }, now);
    expect(points).toHaveLength(1);
    expect(historyChange(points)).toBe(0);
  });
});
