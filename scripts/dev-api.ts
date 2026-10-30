/**
 * Runs the /api functions on http://localhost:3001 without a Vercel account: `npm run api`.
 * It loads GEMINI_API_KEY from .env (node --env-file) and uses the same handlers as Vercel.
 */
import { createServer } from 'node:http';
import advise from '../api/advise';
import diagnose from '../api/diagnose-fruit-trap';
import readLabel from '../api/read-label';

type Handler = (req: never, res: never) => Promise<unknown>;
const routes: Record<string, Handler> = {
  '/api/read-label': readLabel as unknown as Handler,
  '/api/diagnose-fruit-trap': diagnose as unknown as Handler,
  '/api/advise': advise as unknown as Handler,
};

const PORT = Number(process.env.PORT ?? 3001);

createServer((req, res) => {
  const handler = routes[(req.url ?? '').split('?')[0]];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"ok":false}');
    return;
  }
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    let body: unknown;
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
    } catch {
      body = undefined;
    }
    // The few parts of the Vercel request/response that our handler uses.
    const vreq = { method: req.method, headers: req.headers, body };
    const vres = {
      setHeader: (k: string, v: string) => res.setHeader(k, v),
      status: (code: number) => ({
        json: (data: unknown) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(data)),
        end: () => res.writeHead(code).end(),
      }),
    };
    void handler(vreq as never, vres as never);
  });
}).listen(PORT, () => {
  console.log(`AI API on http://localhost:${PORT}  (key ${process.env.GEMINI_API_KEY ? 'found' : 'MISSING: results will be { ok: false }'})`);
});
