import { RECORDS_COMPLETE_MIN, trustBadges } from './badges';

const base = { records: 90, hasBanned: false, paidDeliveries: 0, labFailed: 0 };
const ids = (input: Parameters<typeof trustBadges>[0]) => trustBadges(input).map((b) => b.id);

describe('trustBadges', () => {
  it('gives Complete records and No banned products to a clean lot without history', () => {
    expect(ids(base)).toEqual(['complete-records', 'no-banned']);
  });
  it('gives Reliable delivery after a paid delivery with no failed lab check', () => {
    expect(ids({ ...base, paidDeliveries: 1 })).toEqual(['reliable-delivery', 'complete-records', 'no-banned']);
  });
  it('takes Reliable delivery away when a lab check failed', () => {
    expect(ids({ ...base, paidDeliveries: 3, labFailed: 1 })).not.toContain('reliable-delivery');
  });
  it('needs the records score to reach the limit', () => {
    expect(ids({ ...base, records: RECORDS_COMPLETE_MIN })).toContain('complete-records');
    expect(ids({ ...base, records: RECORDS_COMPLETE_MIN - 1 })).not.toContain('complete-records');
  });
  it('gives no No banned products badge when a banned product was used', () => {
    expect(ids({ ...base, hasBanned: true })).toEqual(['complete-records']);
  });
  it('explains each badge in one line', () => {
    const [first] = trustBadges({ ...base, paidDeliveries: 2 });
    expect(first.label).toBe('Reliable delivery');
    expect(first.why).toContain('2 times');
  });
});
