/**
 * Server side of the AI features. Pure TypeScript with an injectable `fetch`, so it is tested without the network.
 * The Vercel functions in /api only call these. The Gemini key is read from the environment there and never reaches the app.
 */
import { ADVICE_SCHEMA, FRUIT_SCHEMA, LABEL_SCHEMA, TRAP_SCHEMA, advicePrompt, FRUIT_PROMPT, LABEL_PROMPT, TRAP_PROMPT } from './prompts';
import { allStrings, containsChemicalAdvice, numbersIn, sentenceCount } from './safety';
import {
  adviceResult,
  adviseRequest,
  diagnoseRequest,
  fruitResult,
  labelResult,
  readLabelRequest,
  trapResult,
  type AdviseRequest,
} from './schemas';

/**
 * The alias of the current Gemini Flash model (it has vision). Model names get retired (gemini-2.5-flash already stopped working for new keys),
 * so the alias keeps the demo alive. Pin a fixed model with GEMINI_MODEL, for example gemini-3.8-flash.
 */
export const DEFAULT_MODEL = 'gemini-flash-latest';
export const TIMEOUT_MS = 15_000;

export interface AiEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export interface AiDeps {
  env: AiEnv;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface ServerReply {
  status: number;
  body: { ok: boolean; [key: string]: unknown };
}

const FAIL: ServerReply = { status: 200, body: { ok: false } };
const bad = (status: number): ServerReply => ({ status, body: { ok: false } });

function mimeOf(base64: string): string {
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

/** One Gemini call with JSON output. Returns the parsed JSON, or null on any problem (no key, timeout, HTTP error, bad JSON). */
export async function callGemini(deps: AiDeps, opts: { prompt: string; imageBase64?: string; schema: object }): Promise<unknown | null> {
  const key = deps.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = deps.env.GEMINI_MODEL || DEFAULT_MODEL;
  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  try {
    const parts: object[] = [{ text: opts.prompt }];
    if (opts.imageBase64) parts.push({ inlineData: { mimeType: mimeOf(opts.imageBase64), data: opts.imageBase64 } });
    const res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: opts.schema, temperature: 0.2 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function readLabel(body: unknown, deps: AiDeps): Promise<ServerReply> {
  const req = readLabelRequest.safeParse(body);
  if (!req.success) return bad(400);
  const raw = await callGemini(deps, { prompt: LABEL_PROMPT, imageBase64: req.data.imageBase64, schema: LABEL_SCHEMA });
  const out = labelResult.safeParse(raw);
  return out.success ? { status: 200, body: { ok: true, ...out.data } } : FAIL;
}

export async function diagnoseFruitTrap(body: unknown, deps: AiDeps): Promise<ServerReply> {
  const req = diagnoseRequest.safeParse(body);
  if (!req.success) return bad(400);
  const { imageBase64, mode } = req.data;
  const raw = await callGemini(deps, {
    prompt: mode === 'fruit' ? FRUIT_PROMPT : TRAP_PROMPT,
    imageBase64,
    schema: mode === 'fruit' ? FRUIT_SCHEMA : TRAP_SCHEMA,
  });
  const out = (mode === 'fruit' ? fruitResult : trapResult).safeParse(raw);
  if (!out.success) return FAIL;
  const text = allStrings(out.data).join(' ');
  return containsChemicalAdvice(text) ? FAIL : { status: 200, body: { ok: true, mode, ...out.data } };
}

/** Numbers we allow in the advisor text: the ones in the data, and small counting numbers (1–7: "in 2 days"). */
function allowedNumbers(input: AdviseRequest): Set<number> {
  const set = new Set<number>([1, 2, 3, 4, 5, 6, 7]);
  for (const n of numbersIn(JSON.stringify(input))) set.add(n);
  for (const r of input.risks) set.add(Math.round(r.score));
  return set;
}

export async function advise(body: unknown, deps: AiDeps): Promise<ServerReply> {
  const req = adviseRequest.safeParse(body);
  if (!req.success) return bad(400);
  const raw = await callGemini(deps, { prompt: advicePrompt(req.data), schema: ADVICE_SCHEMA });
  const out = adviceResult.safeParse(raw);
  if (!out.success) return FAIL;
  const a = out.data;
  const text = allStrings(a).join(' ');
  const allowed = allowedNumbers(req.data);
  const inventedNumber = numbersIn(text).some((n) => !allowed.has(n));
  if (sentenceCount(a.summary) > 2 || containsChemicalAdvice(text) || inventedNumber) return FAIL;
  return { status: 200, body: { ok: true, ...a } };
}
