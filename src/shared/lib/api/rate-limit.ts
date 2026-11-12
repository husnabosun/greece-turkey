/** Simple in-memory rate limiter (per server instance). Good enough for demos; use Redis before public launch. */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export class RateLimiter {
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true when the call is allowed. */
  allow(key: string, now = Date.now()): boolean {
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.limit) return false;
    bucket.count += 1;
    return true;
  }
}

/** 20 AI calls / 10 minutes / device (legacy demo policy). */
export const aiRateLimiter = new RateLimiter(20, 10 * 60 * 1000);
