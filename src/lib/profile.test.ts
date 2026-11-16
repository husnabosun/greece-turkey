import { factories, farmerProfiles, fields } from '@/data/mock';
import { activeInbox, addToInbox, harvestReminders, offerNotification } from './notifications';
import { applyProfile, countryOf, languageFromLocales, localFactory, weatherKey } from './profile';

describe('languageFromLocales', () => {
  it('picks the first supported language of the device', () => {
    expect(languageFromLocales(['el-GR'])).toBe('el');
    expect(languageFromLocales(['tr_TR'])).toBe('tr');
    expect(languageFromLocales(['de-DE', 'tr-TR'])).toBe('tr');
  });
  it('falls back to English', () => {
    expect(languageFromLocales(['de-DE'])).toBe('en');
    expect(languageFromLocales([])).toBe('en');
  });
});

describe('farmer profiles', () => {
  it('Greek shows the farmer in Greece, Turkish and English the farmer in Türkiye', () => {
    expect(countryOf('el')).toBe('gr');
    expect(countryOf('tr')).toBe('tr');
    expect(countryOf('en')).toBe('tr');
  });

  it('both countries describe every demo field', () => {
    for (const p of Object.values(farmerProfiles)) expect(Object.keys(p.fields).sort()).toEqual(fields.map((f) => f.id).sort());
  });

  it('changes names, varieties and coordinates, and keeps scores and added fields', () => {
    const added = { ...fields[0], id: 'f123', name: 'My new field' };
    const gr = applyProfile([...fields, added], farmerProfiles.gr);
    const north = gr.find((f) => f.id === 'north')!;
    expect(north.name).toBe(farmerProfiles.gr.fields.north.name);
    expect(north.variety).toBe('Koroneiki');
    expect(north.lat).toBeLessThan(38);
    expect(north.score).toBe(fields.find((f) => f.id === 'north')!.score);
    expect(gr.find((f) => f.id === 'f123')!.name).toBe('My new field');
    // And back.
    expect(applyProfile(gr, farmerProfiles.tr).find((f) => f.id === 'north')!.name).toBe('North grove');
  });

  it('shows the demo factories with local varieties and regions in Greece', () => {
    const f = factories.find((x) => x.variety === 'Ayvalık' && x.region === 'Aydın')!;
    expect(localFactory(f, farmerProfiles.gr)).toMatchObject({ variety: 'Koroneiki', region: 'Messinia' });
    expect(localFactory(f, farmerProfiles.tr)).toMatchObject({ variety: 'Ayvalık', region: 'Aydın' });
  });

  it('keeps the weather of the two countries apart', () => {
    expect(weatherKey('north', 'tr')).not.toBe(weatherKey('north', 'gr'));
  });
});

describe('inbox under the bell', () => {
  const river = { id: 'river', name: 'River plot', harvest: { ready: true, badge: 'Now' } };
  const offer = { id: 'o9', fieldId: 'river', factoryId: 'demo', status: 'open', pricePerKg: 0.95, tons: 2.5 };
  const base = { fields: [river], listings: [], offers: [offer], factoryName: () => 'Demo Olive Oil Co.' };

  it('keeps only notifications that open a screen, newest first, without duplicates', () => {
    const ids = addToInbox(addToInbox([], harvestReminders([river])), [offerNotification(offer, 'Demo Olive Oil Co.', 'River plot'), harvestReminders([river])[0]]);
    expect(ids).toEqual(['offer-o9', 'harvest-river']);
    expect(addToInbox([], [{ id: 'n1', emoji: '', title: '', body: '', when: 'now' }])).toEqual([]);
  });

  it('builds the texts from the current state', () => {
    const list = activeInbox(['offer-o9', 'harvest-river'], { ...base, fields: [{ ...river, name: 'Ποτάμι' }] });
    expect(list.map((n) => n.title)).toEqual(['New offer: €0.95/kg', 'Ποτάμι is ready to harvest']);
  });

  it('drops a harvest reminder once the field is listed, and an offer once it is accepted', () => {
    expect(activeInbox(['harvest-river'], { ...base, listings: [{ fieldId: 'river' }] })).toEqual([]);
    expect(activeInbox(['offer-o9'], { ...base, offers: [{ ...offer, status: 'accepted' }] })).toEqual([]);
  });
});
