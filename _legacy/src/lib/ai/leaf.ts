/**
 * Leaf photo -> our own model, which runs in a Hugging Face Space (research/03_hf_space).
 * Pure TypeScript: the call to the Space is injected, so it is tested without the network.
 * Any problem (no Space, timeout, strange answer) gives the demo result with source "demo", never an error.
 */
import { leafRequest, leafSpaceAnswer, type LeafResult } from './schemas';
import type { AiDeps, ServerReply } from './server';

export const LEAF_SPACE = 'hupus/agropulse-leaf';
/** A sleeping Space needs about a minute to wake up. */
export const LEAF_TIMEOUT_MS = 60_000;
/** Version of the model inside the Space (research/models/model_info.json). Change it when the Space gets a new model. */
export const LEAF_MODEL_VERSION = 'v2';

export interface LeafImage {
  bytes: Uint8Array;
  mime: string;
}

/** Calls the Space and returns its raw JSON answer. Lives in /api because it needs @gradio/client. */
export type LeafPredict = (image: LeafImage, token: string | undefined) => Promise<unknown>;

export interface LeafDeps extends AiDeps {
  predictLeaf?: LeafPredict;
}

/** Shown when the model cannot be reached. The app marks it as a demo result. */
export const DEMO_LEAF: LeafResult = {
  source: 'demo',
  label: 'Olive Peacock Spot',
  confidence: 0.92,
  top3: [
    { label: 'Olive Peacock Spot', confidence: 0.92 },
    { label: 'Healthy', confidence: 0.06 },
    { label: 'Aculus Olearius', confidence: 0.02 },
  ],
  modelVersion: 'demo',
};

function mimeOf(base64: string): string {
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export async function diagnoseLeaf(body: unknown, deps: LeafDeps): Promise<ServerReply> {
  const req = leafRequest.safeParse(body);
  if (!req.success) return { status: 400, body: { ok: false } };
  const demo: ServerReply = { status: 200, body: { ok: true, ...DEMO_LEAF } };
  if (!deps.predictLeaf) return demo;
  try {
    const bytes = Uint8Array.from(atob(req.data.imageBase64), (c) => c.charCodeAt(0));
    const raw = await withTimeout(deps.predictLeaf({ bytes, mime: mimeOf(req.data.imageBase64) }, deps.env.HF_TOKEN || undefined), deps.timeoutMs ?? LEAF_TIMEOUT_MS);
    const answer = leafSpaceAnswer.safeParse(raw);
    if (!answer.success) return demo;
    return { status: 200, body: { ok: true, source: 'model', ...answer.data, modelVersion: LEAF_MODEL_VERSION } };
  } catch {
    return demo;
  }
}
