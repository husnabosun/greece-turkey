import type { VercelRequest, VercelResponse } from '@vercel/node';
import { RateLimiter } from '../../src/lib/ai/rateLimit';
import type { AiDeps, ServerReply } from '../../src/lib/ai/server';

const limiter = new RateLimiter(20, 10 * 60 * 1000);

/** Wraps one endpoint: method, CORS (not in production), rate limit per device, then the work. Always answers JSON. */
export function endpoint(work: (body: unknown, deps: AiDeps) => Promise<ServerReply>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // In production the app and /api share one domain, so no CORS is needed. In local development the app runs on another port.
    if (process.env.VERCEL_ENV !== 'production') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false });

    const header = req.headers['x-device-id'];
    const device = (Array.isArray(header) ? header[0] : header) || String(req.headers['x-forwarded-for'] ?? 'unknown');
    if (!limiter.allow(device.slice(0, 80))) return res.status(429).json({ ok: false });

    try {
      const reply = await work(req.body, { env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL } });
      return res.status(reply.status).json(reply.body);
    } catch {
      return res.status(500).json({ ok: false });
    }
  };
}
