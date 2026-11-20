import { euCheck } from '../euCheck';
import { assessField } from '../risk';
import { demoWeather } from '../weather';
import { buildSignals } from '../risk/signals';
import { fields, initialScans, sprays } from '../../data/mock';
import { adviceKey, buildAdviceRequest, fallbackAdvice, fruitToDiagnosis, labelToDraft, trapToDiagnosis } from './mappers';
import { RateLimiter } from './rateLimit';
import { containsChemicalAdvice, sentenceCount } from './safety';
import { MAX_IMAGE_BASE64, adviseRequest } from './schemas';
import { advise, callGemini, diagnoseFruitTrap, readLabel, type AiDeps } from './server';

const IMG = 'A'.repeat(200);

/** A fake Gemini: answers with `payload` as JSON text. */
function fakeGemini(payload: unknown, ok = true): { deps: AiDeps; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) };
  }) as unknown as typeof fetch;
  return { deps: { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl }, calls };
}

const NOW = Date.UTC(2026, 9, 20, 10);
const field = fields[0];
const weather = demoWeather({ id: field.id, lat: field.lat, lon: field.lon }, NOW);
const risk = assessField(weather, buildSignals(field, initialScans, sprays), NOW);
const request = buildAdviceRequest({ language: 'tr', field, risk, weather, scans: initialScans, sprays, now: NOW });

describe('callGemini', () => {
  it('sends the key in a header, asks for JSON with a schema and uses the default model', async () => {
    const { deps, calls } = fakeGemini({ x: 1 });
    expect(await callGemini(deps, { prompt: 'hi', imageBase64: IMG, schema: { type: 'OBJECT' } })).toEqual({ x: 1 });
    const [{ url, init }] = calls;
    expect(url).toContain('gemini-flash-latest:generateContent');
    expect(url).not.toContain('test-key');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toEqual({ type: 'OBJECT' });
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
  });

  it('uses GEMINI_MODEL when set', async () => {
    const { deps, calls } = fakeGemini({});
    await callGemini({ ...deps, env: { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-x' } }, { prompt: 'p', schema: {} });
    expect(calls[0].url).toContain('models/gemini-x:');
  });

  it('returns null without a key, on HTTP errors, on bad JSON and on timeout', async () => {
    expect(await callGemini({ env: {} }, { prompt: 'p', schema: {} })).toBeNull();
    expect(await callGemini(fakeGemini({}, false).deps, { prompt: 'p', schema: {} })).toBeNull();
    const badJson = { env: { GEMINI_API_KEY: 'k' }, fetchImpl: (async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }) })) as unknown as typeof fetch };
    expect(await callGemini(badJson, { prompt: 'p', schema: {} })).toBeNull();
    const hang = {
      env: { GEMINI_API_KEY: 'k' },
      timeoutMs: 20,
      fetchImpl: ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch,
    };
    expect(await callGemini(hang, { prompt: 'p', schema: {} })).toBeNull();
  });
});

describe('/api/read-label', () => {
  const label = { productName: 'Cuprocaffaro', activeSubstances: ['copper oxychloride'], licenceNumber: '12-4471', maxDosePerHa: '3 kg/ha', preHarvestDays: 21, cropsListed: ['olive'], confidence: 0.9 };

  it('returns the validated label', async () => {
    const r = await readLabel({ imageBase64: IMG }, fakeGemini(label).deps);
    expect(r.body).toEqual({ ok: true, ...label });
  });
  it('fails closed when Gemini breaks the schema, or there is no key', async () => {
    expect((await readLabel({ imageBase64: IMG }, fakeGemini({ productName: 5 }).deps)).body).toEqual({ ok: false });
    expect((await readLabel({ imageBase64: IMG }, { env: {} })).body).toEqual({ ok: false });
  });
  it('rejects a missing or too large image with 400', async () => {
    expect((await readLabel({}, fakeGemini(label).deps)).status).toBe(400);
    expect((await readLabel({ imageBase64: 'A'.repeat(MAX_IMAGE_BASE64 + 1) }, fakeGemini(label).deps)).status).toBe(400);
  });
});

describe('/api/diagnose-fruit-trap', () => {
  it('fruit: a diagnosis from the allowed list', async () => {
    const r = await diagnoseFruitTrap({ imageBase64: IMG, mode: 'fruit' }, fakeGemini({ diagnosis: 'olive fly sting', confidence: 0.8, symptoms: ['small dark dot'] }).deps);
    expect(r.body.ok).toBe(true);
    expect((await diagnoseFruitTrap({ imageBase64: IMG, mode: 'fruit' }, fakeGemini({ diagnosis: 'anthracnose', confidence: 0.8, symptoms: [] }).deps)).body).toEqual({ ok: false });
  });
  it('trap: a whole number of flies', async () => {
    const r = await diagnoseFruitTrap({ imageBase64: IMG, mode: 'trap' }, fakeGemini({ flyCount: 14, confidence: 0.7, notes: 'Some small gnats too.' }).deps);
    expect(r.body).toMatchObject({ ok: true, mode: 'trap', flyCount: 14 });
    expect((await diagnoseFruitTrap({ imageBase64: IMG, mode: 'trap' }, fakeGemini({ flyCount: 2.5, confidence: 0.7, notes: '' }).deps)).body).toEqual({ ok: false });
  });
  it('rejects an unknown mode (leaf stays with our own model)', async () => {
    expect((await diagnoseFruitTrap({ imageBase64: IMG, mode: 'leaf' }, fakeGemini({}).deps)).status).toBe(400);
  });
});

describe('/api/advise', () => {
  const good = { summary: 'Peacock spot risk is high. The leaves stay wet.', actions: ['Check the leaves in 2 days.', 'Ask a licensed agronomist.'], whyNow: 'It rained and it stays wet.' };

  it('validates the request and returns the advice', async () => {
    expect(adviseRequest.safeParse(request).success).toBe(true);
    const r = await advise(request, fakeGemini(good).deps);
    expect(r.body).toEqual({ ok: true, ...good });
  });
  it('puts the language in the prompt and only our data in the request', async () => {
    const { deps, calls } = fakeGemini(good);
    await advise(request, deps);
    const prompt: string = JSON.parse(String(calls[0].init.body)).contents[0].parts[0].text;
    expect(prompt).toContain('Write in Turkish');
    expect(prompt).toContain('Never recommend a pesticide');
    expect(JSON.parse(String(calls[0].init.body)).contents[0].parts).toHaveLength(1);
  });
  it('refuses advice that names a chemical or a dose', async () => {
    for (const bad of [
      { ...good, actions: ['Spray copper oxychloride.'] },
      { ...good, actions: ['Use 3 kg/ha of the product.'] },
      { ...good, whyNow: 'Use a fungicide now.' },
    ]) {
      expect((await advise(request, fakeGemini(bad).deps)).body).toEqual({ ok: false });
    }
  });
  it('refuses a summary of more than 2 sentences and numbers that are not in the data', async () => {
    expect((await advise(request, fakeGemini({ ...good, summary: 'One. Two. Three.' }).deps)).body).toEqual({ ok: false });
    expect((await advise(request, fakeGemini({ ...good, whyNow: 'There are 47 flies in your field.' }).deps)).body).toEqual({ ok: false });
  });
  it('rejects a bad language with 400', async () => {
    expect((await advise({ ...request, language: 'fr' }, fakeGemini(good).deps)).status).toBe(400);
  });
});

describe('safety helpers', () => {
  it('finds chemicals and doses in English, Turkish and Greek', () => {
    expect(containsChemicalAdvice('Check the leaves and remove fallen fruit.')).toBe(false);
    expect(containsChemicalAdvice('Apply Copper now')).toBe(true);
    expect(containsChemicalAdvice('Bakır uygulayın')).toBe(true);
    expect(containsChemicalAdvice('Ψεκάστε με χαλκό')).toBe(true);
    expect(containsChemicalAdvice('Use 50 ml per 100 l water')).toBe(true);
  });
  it('counts sentences', () => {
    expect(sentenceCount('One. Two!')).toBe(2);
    expect(sentenceCount('Only one sentence')).toBe(1);
  });
});

describe('rate limit', () => {
  it('allows max calls per window per device, then lets the window reset', () => {
    let t = 0;
    const l = new RateLimiter(2, 1000, () => t);
    expect([l.allow('a'), l.allow('a'), l.allow('a'), l.allow('b')]).toEqual([true, true, false, true]);
    t = 1001;
    expect(l.allow('a')).toBe(true);
  });
});

describe('euCheck', () => {
  it('flags substances that are not approved in the EU', () => {
    expect(euCheck(['copper oxychloride'])).toEqual({ banned: false, hits: [] });
    expect(euCheck(['Chlorpyrifos-methyl', 'copper hydroxide'])).toEqual({ banned: true, hits: ['chlorpyrifos'] });
    expect(euCheck(['dimethoate']).banned).toBe(true);
  });
});

describe('mappers', () => {
  it('maps a fruit answer, and treats low confidence as not clear', () => {
    expect(fruitToDiagnosis({ diagnosis: 'olive fly sting', confidence: 0.82, symptoms: ['dark dot'] })).toMatchObject({ title: 'Olive fly sting', confidence: 82, source: 'gemini', detail: 'dark dot.' });
    expect(fruitToDiagnosis({ diagnosis: 'healthy', confidence: 0.2, symptoms: [] })).toMatchObject({ title: 'Not clear', pill: 'Retake photo' });
    expect(fruitToDiagnosis({ diagnosis: 'healthy', confidence: 0.9, symptoms: [] }).tone).toBe('healthy');
  });
  it('maps a trap answer: the counted flies feed the risk engine as a trap scan', () => {
    const dx = trapToDiagnosis({ flyCount: 16, confidence: 0.8, notes: '' });
    expect(dx).toMatchObject({ flies: 16, tone: 'high', photo: 'trap' });
    expect(trapToDiagnosis({ flyCount: 6, confidence: 0.8, notes: '' }).tone).toBe('medium');
    expect(trapToDiagnosis({ flyCount: 3, confidence: 0.2, notes: '' }).pill).toBe('Retake photo');
    const scan = { ...initialScans[0], fieldId: field.id, mode: 'trap' as const, ts: NOW - 3600_000, ...dx };
    const signals = buildSignals(field, [scan], sprays);
    expect(signals.scans.find((s) => s.mode === 'trap' && s.flies === 16)).toBeTruthy();
  });
  it('maps a label and runs the EU check on the substances', () => {
    const d = labelToDraft({ productName: ' Dursban ', activeSubstances: ['chlorpyrifos'], licenceNumber: null, maxDosePerHa: null, preHarvestDays: null, cropsListed: [], confidence: 0.85 });
    expect(d).toMatchObject({ product: 'Dursban', licence: undefined, unsure: false, eu: { banned: true } });
    expect(labelToDraft({ productName: '', activeSubstances: [], licenceNumber: null, maxDosePerHa: null, preHarvestDays: null, cropsListed: [], confidence: 0.9 }).unsure).toBe(true);
  });
  it('builds a small advisor request from the engine output only', () => {
    expect(request.risks.length).toBeGreaterThan(0);
    expect(request.risks.length).toBeLessThanOrEqual(4);
    expect(request.risks.every((r) => r.score >= 0 && r.score <= 100)).toBe(true);
    expect(adviceKey(request)).toBe(adviceKey({ ...request }));
    expect(adviceKey(request)).not.toBe(adviceKey({ ...request, language: 'el' }));
  });
  it('has a plain English fallback from the engine', () => {
    const f = fallbackAdvice(risk, field.name);
    expect(f.summary.length).toBeGreaterThan(5);
    expect(f.actions.length).toBeGreaterThan(0);
    expect(containsChemicalAdvice(f.actions.join(' '))).toBe(false);
  });
});
