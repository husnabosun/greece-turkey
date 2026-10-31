import { actionsFor, explain, NOT_SURE_TEXT } from '../diagnosis';
import { DEMO_LEAF, diagnoseLeaf, LEAF_MODEL_VERSION, type LeafDeps, type LeafPredict } from './leaf';
import { LEAF_MIN_CONFIDENCE, leafToDiagnosis } from './mappers';
import { MAX_IMAGE_BASE64, leafResult, type LeafResult } from './schemas';

const IMG = btoa('x'.repeat(200));
const answer = (label: string, confidence: number) => ({
  label,
  confidence,
  top3: [
    { label, confidence },
    { label: 'Healthy', confidence: 0.05 },
  ],
});

const deps = (predictLeaf?: LeafPredict, extra: Partial<LeafDeps> = {}): LeafDeps => ({ env: { HF_TOKEN: 'hf_test' }, predictLeaf, ...extra });

describe('diagnoseLeaf', () => {
  it('returns the answer of the model with source "model" and the model version', async () => {
    const predict = jest.fn(async () => answer('Olive Peacock Spot', 0.93));
    const reply = await diagnoseLeaf({ imageBase64: IMG }, deps(predict));
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ ok: true, source: 'model', label: 'Olive Peacock Spot', confidence: 0.93, modelVersion: LEAF_MODEL_VERSION });
    expect(leafResult.safeParse(reply.body).success).toBe(true);
  });

  it('sends the decoded photo and the token to the model', async () => {
    const predict = jest.fn(async () => answer('Healthy', 0.9));
    await diagnoseLeaf({ imageBase64: IMG }, deps(predict));
    const [image, token] = predict.mock.calls[0] as unknown as [{ bytes: Uint8Array; mime: string }, string];
    expect(image.mime).toBe('image/jpeg');
    expect(image.bytes).toHaveLength(200);
    expect(token).toBe('hf_test');
  });

  it('calls the model without a token when there is none', async () => {
    const predict = jest.fn(async () => answer('Healthy', 0.9));
    await diagnoseLeaf({ imageBase64: IMG }, { env: { HF_TOKEN: '' }, predictLeaf: predict });
    expect((predict.mock.calls[0] as unknown[])[1]).toBeUndefined();
  });

  it('gives the demo result when the model fails', async () => {
    const reply = await diagnoseLeaf({ imageBase64: IMG }, deps(async () => Promise.reject(new Error('Space is down'))));
    expect(reply).toEqual({ status: 200, body: { ok: true, ...DEMO_LEAF } });
    expect(reply.body.source).toBe('demo');
  });

  it('gives the demo result after the time limit', async () => {
    const reply = await diagnoseLeaf({ imageBase64: IMG }, deps(() => new Promise(() => {}), { timeoutMs: 20 }));
    expect(reply.body.source).toBe('demo');
  });

  it('gives the demo result when the model answers something strange', async () => {
    for (const raw of [null, 'oops', { label: 'Cat', confidence: 0.9, top3: [] }, { label: 'Healthy', confidence: 3, top3: [{ label: 'Healthy', confidence: 3 }] }, { error: 'Send a photo of one olive leaf.' }]) {
      const reply = await diagnoseLeaf({ imageBase64: IMG }, deps(async () => raw));
      expect(reply.body.source).toBe('demo');
    }
  });

  it('gives the demo result when no model is connected', async () => {
    expect((await diagnoseLeaf({ imageBase64: IMG }, deps())).body.source).toBe('demo');
  });

  it('refuses a request that is not a photo, or a photo that is too big', async () => {
    expect((await diagnoseLeaf({}, deps())).status).toBe(400);
    expect((await diagnoseLeaf({ imageBase64: 'abc' }, deps())).status).toBe(400);
    expect((await diagnoseLeaf({ imageBase64: 'A'.repeat(MAX_IMAGE_BASE64 + 1) }, deps())).status).toBe(400);
  });
});

describe('leafToDiagnosis', () => {
  const result = (label: LeafResult['label'], confidence: number): LeafResult => ({ ...answer(label, confidence), label, source: 'model', modelVersion: 'v2' } as LeafResult);

  it('shows a healthy leaf', () => {
    expect(leafToDiagnosis(result('Healthy', 0.98))).toMatchObject({ title: 'Healthy leaf', tone: 'healthy', confidence: 98, source: 'model', modelVersion: 'v2' });
  });
  it('shows peacock spot as high risk when the model is very sure, else medium', () => {
    expect(leafToDiagnosis(result('Olive Peacock Spot', 0.95))).toMatchObject({ title: 'Peacock spot', tone: 'high', pill: 'High risk', latin: 'Spilocaea oleaginea' });
    expect(leafToDiagnosis(result('Olive Peacock Spot', 0.7))).toMatchObject({ tone: 'medium', pill: 'Medium risk' });
  });
  it('shows the olive bud mite for Aculus olearius', () => {
    expect(leafToDiagnosis(result('Aculus Olearius', 0.9))).toMatchObject({ title: 'Olive bud mite', latin: 'Aculus olearius', tone: 'watch' });
  });
  it('asks for a new photo below 60 %', () => {
    expect(LEAF_MIN_CONFIDENCE).toBe(0.6);
    const unsure = leafToDiagnosis(result('Olive Peacock Spot', 0.59));
    expect(unsure).toMatchObject({ title: 'Not sure', pill: 'Retake photo', confidence: 59 });
    expect(unsure.detail).toContain('Peacock spot 59 %');
    expect(leafToDiagnosis(result('Olive Peacock Spot', 0.6)).title).toBe('Peacock spot');
  });
  it('explains each result in plain words', () => {
    const unsure = leafToDiagnosis(result('Healthy', 0.4));
    expect(explain({ mode: 'leaf', ...unsure } as Parameters<typeof explain>[0]).headline).toBe(NOT_SURE_TEXT);
    expect(NOT_SURE_TEXT).toBe('Not sure – retake the photo in good light, or ask an agronomist');
    const mite = leafToDiagnosis(result('Aculus Olearius', 0.9));
    expect(explain({ mode: 'leaf', ...mite } as Parameters<typeof explain>[0]).headline).toContain('olive bud mite');
  });
  it('suggests a retake for an unsure result and no chemicals for the others', () => {
    expect(actionsFor({ mode: 'leaf', title: 'Not sure', tone: 'watch', confidence: 50 })[0].title).toBe('Take a new photo');
    const all = [leafToDiagnosis(result('Aculus Olearius', 0.9)), leafToDiagnosis(result('Olive Peacock Spot', 0.9))].flatMap((d) => actionsFor({ mode: 'leaf', ...d }));
    expect(all.every((a) => !/spray|pesticide|chemical/i.test(`${a.title} ${a.hint}`))).toBe(true);
  });
});
