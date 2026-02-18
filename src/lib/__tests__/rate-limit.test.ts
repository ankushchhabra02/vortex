import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimit } from '../rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows requests within the limit', () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 3 });
    const r1 = limiter.check('user-1');
    const r2 = limiter.check('user-1');
    const r3 = limiter.check('user-1');

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
  });

  it('blocks requests exceeding the limit', () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 2 });
    limiter.check('user-2');
    limiter.check('user-2');
    const r3 = limiter.check('user-2');

    expect(r3.success).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.resetMs).toBeGreaterThan(0);
  });

  it('tracks different keys independently', () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 1 });
    const rA = limiter.check('key-a');
    const rB = limiter.check('key-b');

    expect(rA.success).toBe(true);
    expect(rB.success).toBe(true);

    // key-a is now exhausted
    const rA2 = limiter.check('key-a');
    expect(rA2.success).toBe(false);

    // key-b is also exhausted
    const rB2 = limiter.check('key-b');
    expect(rB2.success).toBe(false);
  });

  it('returns correct remaining count', () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 5 });
    const r1 = limiter.check('user-3');
    expect(r1.remaining).toBe(4);

    const r2 = limiter.check('user-3');
    expect(r2.remaining).toBe(3);

    limiter.check('user-3');
    limiter.check('user-3');
    const r5 = limiter.check('user-3');
    expect(r5.remaining).toBe(0);
    expect(r5.success).toBe(true);

    // Next one should be blocked
    const r6 = limiter.check('user-3');
    expect(r6.success).toBe(false);
  });

  it('allows requests after the window expires', () => {
    vi.useFakeTimers();
    const limiter = rateLimit({ interval: 1_000, maxRequests: 1 });

    const r1 = limiter.check('user-4');
    expect(r1.success).toBe(true);

    const r2 = limiter.check('user-4');
    expect(r2.success).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(1_100);

    const r3 = limiter.check('user-4');
    expect(r3.success).toBe(true);

    vi.useRealTimers();
  });
});
