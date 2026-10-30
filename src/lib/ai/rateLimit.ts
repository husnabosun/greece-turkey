/**
 * A simple fixed-window rate limit per device.
 * It lives in the memory of one serverless instance, so it is a speed bump against a runaway app or a loop,
 * not real protection: use a shared store (for example Upstash Redis) before a public launch.
 */
export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly max = 20,
    private readonly windowMs = 10 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns true when the call is allowed. */
  allow(deviceId: string): boolean {
    const t = this.now();
    if (this.hits.size > 5000) this.prune(t);
    const h = this.hits.get(deviceId);
    if (!h || t - h.start >= this.windowMs) {
      this.hits.set(deviceId, { start: t, count: 1 });
      return true;
    }
    h.count += 1;
    return h.count <= this.max;
  }

  private prune(t: number) {
    for (const [k, h] of this.hits) if (t - h.start >= this.windowMs) this.hits.delete(k);
  }
}
