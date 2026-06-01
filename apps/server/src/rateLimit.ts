/** Per-connection token bucket — bounds claim rate per socket regardless of userId. */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
  }

  /** Consume one token; returns false (rejected) when the bucket is empty. */
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
    this.last = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

/** Loopback addresses are exempt from the per-IP cap (local dev opens many conns). */
export function isLoopback(addr: string): boolean {
  return addr === '::1' || addr === '127.0.0.1' || addr.startsWith('::ffff:127.');
}
