import { PROCESSOR_ID, season } from '@/data/mock';
import { completedDeliveries, farmersBoughtFrom, seasonStats } from '@/lib/processor';
import { useStore } from './store';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const initial = useStore.getState();
const s = () => useStore.getState();

beforeEach(() => useStore.setState(initial, true));

describe('processor offer reaches the farmer', () => {
  it('shows up in the farmer offers for a field of the demo farmer', () => {
    const before = s().offers.length;
    s().makeOffer({ lotId: 'river', tons: 2, pricePerKg: 0.95, deliveryIn: 5 });
    const made = s().offers.find((o) => o.factoryId === PROCESSOR_ID);
    expect(s().offers).toHaveLength(before + 1);
    expect(made).toMatchObject({ fieldId: 'river', pricePerKg: 0.95, tons: 2, deliveryIn: 5, status: 'open' });
  });
  it('replaces the earlier open offer of the processor for the same field', () => {
    s().makeOffer({ lotId: 'river', tons: 2, pricePerKg: 0.9, deliveryIn: 5 });
    s().makeOffer({ lotId: 'river', tons: 2.5, pricePerKg: 1, deliveryIn: 7 });
    const mine = s().offers.filter((o) => o.factoryId === PROCESSOR_ID);
    expect(mine).toHaveLength(1);
    expect(mine[0].pricePerKg).toBe(1);
  });
  it('keeps offers for lots of other farmers out of the farmer app', () => {
    const before = s().offers.length;
    s().makeOffer({ lotId: 'lot-ay1', tons: 6, pricePerKg: 0.95, deliveryIn: 5 });
    expect(s().offers).toHaveLength(before);
    expect(s().sentOffers).toHaveLength(1);
  });
});

describe('farmer accepts a processor offer', () => {
  it('moves it to Sales and creates a linked delivery in the processor panel', () => {
    s().makeOffer({ lotId: 'river', tons: 2, pricePerKg: 0.95, deliveryIn: 7 });
    const offer = s().offers.find((o) => o.factoryId === PROCESSOR_ID)!;
    const deliveries = s().deliveries.length;
    s().acceptOffer(offer.id);
    const sale = s().sales[0];
    expect(sale).toMatchObject({ factoryId: PROCESSOR_ID, fieldId: 'river', tons: 2, pricePerKg: 0.95, status: 'inProgress' });
    expect(s().offers.find((o) => o.id === offer.id)!.status).toBe('accepted');
    expect(s().deliveries).toHaveLength(deliveries + 1);
    expect(s().deliveries[0]).toMatchObject({ saleId: sale.id, farmerName: 'Mehmet', tons: 2, scheduledIn: 7, step: 0 });
  });
  it('does not create a delivery for another factory, and accepts only once', () => {
    const deliveries = s().deliveries.length;
    s().acceptOffer('o2');
    s().acceptOffer('o2');
    expect(s().deliveries).toHaveLength(deliveries);
    expect(s().sales.filter((x) => x.factoryId === 'taris' && x.status === 'inProgress')).toHaveLength(1);
  });
});

describe('processor request reaches the farmer', () => {
  it('is created open and shared with the farmer', () => {
    s().createRequest({ variety: 'Gemlik', tons: 8, minScore: 80, window: '1–10 Dec', region: 'Aydın', noBanned: true });
    expect(s().procRequests[0]).toMatchObject({ variety: 'Gemlik', tons: 8, filledTons: 0, farmers: 0, shared: true });
    expect(s().procRequests.filter((r) => r.shared)).toHaveLength(1);
  });
});

describe('incoming offers', () => {
  it('accepting a farmer offer starts a delivery and shows the farmer name', () => {
    const before = s().deliveries.length;
    s().acceptIncomingOffer('io1');
    expect(s().incomingOffers.find((o) => o.id === 'io1')!.status).toBe('accepted');
    expect(s().deliveries).toHaveLength(before + 1);
    expect(s().deliveries[0]).toMatchObject({ farmerName: 'Ayşe Kaya', tons: 6, pricePerKg: 0.95, step: 0 });
    expect(s().sales).toHaveLength(initial.sales.length);
  });
  it('a listing of the demo farmer is an incoming offer, and accepting it creates a sale', () => {
    s().publishListing({ fieldId: 'river', tons: 2.5, pricePerKg: 0.9, period: '3–10 Nov', negotiable: false, delivery: 'pickup' });
    const io = s().incomingOffers.find((o) => o.lotId === 'river')!;
    expect(io).toMatchObject({ tons: 2.5, pricePerKg: 0.9, status: 'open' });
    s().acceptIncomingOffer(io.id);
    expect(s().sales[0]).toMatchObject({ fieldId: 'river', factoryId: PROCESSOR_ID, tons: 2.5 });
    expect(s().deliveries[0].saleId).toBe(s().sales[0].id);
  });
  it('a new listing replaces the older open one', () => {
    const l = { fieldId: 'hill', tons: 1, pricePerKg: 0.9, period: '3–10 Nov', negotiable: false, delivery: 'pickup' as const };
    s().publishListing(l);
    s().publishListing({ ...l, tons: 2 });
    expect(s().incomingOffers.filter((o) => o.lotId === 'hill')).toHaveLength(1);
    expect(s().incomingOffers.find((o) => o.lotId === 'hill')!.tons).toBe(2);
  });
});

describe('delivery steps', () => {
  const accepted = () => {
    s().makeOffer({ lotId: 'river', tons: 2, pricePerKg: 0.95, deliveryIn: 5 });
    s().acceptOffer(s().offers.find((o) => o.factoryId === PROCESSOR_ID)!.id);
    return s().deliveries[0].id;
  };
  const saleOf = (id: string) => s().sales.find((x) => x.id === s().deliveries.find((d) => d.id === id)!.saleId)!;

  it('weighbridge, lab and payment update the delivery and the farmer sale', () => {
    const id = accepted();
    s().recordWeighbridge(id, 1980);
    expect(s().deliveries[0]).toMatchObject({ step: 2, actualKg: 1980 });
    expect(saleOf(id)).toMatchObject({ step: 3, tons: 1.98, actualKg: 1980, status: 'inProgress' });

    s().advanceDelivery(id);
    expect(s().deliveries[0]).toMatchObject({ step: 3, labResult: 'passed' });
    expect(saleOf(id)).toMatchObject({ step: 4, labResult: 'passed', status: 'inProgress' });

    s().advanceDelivery(id);
    expect(s().deliveries[0].step).toBe(4);
    expect(s().deliveries[0].paidDate).toMatch(/\d{4}$/);
    expect(saleOf(id)).toMatchObject({ status: 'paid' });
  });
  it('ignores a weighbridge value that is not positive, and cannot skip the weighbridge', () => {
    const id = accepted();
    s().recordWeighbridge(id, 0);
    s().advanceDelivery(id);
    expect(s().deliveries[0].step).toBe(0);
  });
  it('works on seeded deliveries that have no farmer sale', () => {
    const sales = s().sales.length;
    s().recordWeighbridge('d1', 5100);
    expect(s().deliveries.find((d) => d.id === 'd1')).toMatchObject({ step: 2, actualKg: 5100 });
    expect(s().sales).toHaveLength(sales);
  });
});

describe('the farmer side still works', () => {
  it('a new spray changes the data the processor sees', () => {
    const before = s().sprays.filter((x) => x.fieldId === 'river').length;
    s().addSpray({ fieldId: 'river', product: 'Kaolin clay', ts: Date.now(), date: 'Today', area: 'whole field', dose: '50 kg/ha', banned: false });
    expect(s().sprays.filter((x) => x.fieldId === 'river')).toHaveLength(before + 1);
  });
});

describe('purchase history in the store', () => {
  it('a delivery marked as paid joins the completed deliveries and the season totals', () => {
    s().makeOffer({ lotId: 'river', tons: 2, pricePerKg: 0.95, deliveryIn: 5 });
    s().acceptOffer(s().offers.find((o) => o.factoryId === PROCESSOR_ID)!.id);
    const id = s().deliveries[0].id;
    expect(s().deliveries[0]).toMatchObject({ score: 86, bannedFree: true });

    const before = seasonStats(s().deliveries, season);
    s().recordWeighbridge(id, 1980);
    s().advanceDelivery(id);
    s().advanceDelivery(id);

    expect(completedDeliveries(s().deliveries)[0]).toMatchObject({ id, paidAgo: 0, score: 86 });
    expect(seasonStats(s().deliveries, season)).toMatchObject({ deliveries: before.deliveries + 1, spent: before.spent + 1900 });
    expect(seasonStats(s().deliveries, season).tons).toBeCloseTo(before.tons + 1.98, 1);
    expect(farmersBoughtFrom(completedDeliveries(s().deliveries)).find((f) => f.farmerName === 'Mehmet')).toMatchObject({ deliveries: 1, avgScore: 86 });
  });
  it('a lot with a banned product lowers the share without banned products', () => {
    s().makeOffer({ lotId: 'north', tons: 1, pricePerKg: 0.8, deliveryIn: 5 });
    s().acceptOffer(s().offers.find((o) => o.factoryId === PROCESSOR_ID)!.id);
    const id = s().deliveries[0].id;
    expect(s().deliveries[0].bannedFree).toBe(false);
    s().recordWeighbridge(id, 1000);
    s().advanceDelivery(id);
    s().advanceDelivery(id);
    expect(seasonStats(s().deliveries, season)).toMatchObject({ deliveries: 9, cleanShare: 78 });
  });
  it('an accepted farmer offer keeps the score and banned-product flag of the lot', () => {
    s().acceptIncomingOffer('io1');
    expect(s().deliveries[0]).toMatchObject({ score: 88, bannedFree: true });
  });
});
