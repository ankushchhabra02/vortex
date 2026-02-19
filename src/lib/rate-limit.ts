import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  interval: number;
  maxRequests: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
}

const store = new Map<string, RateLimitEntry>();

let cleanupStarted = false;

function ensureCleanup(windowMs: number) {
  if (cleanupStarted) return;
  cleanupStarted = true;
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter(t => now - t < windowMs * 2);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 60_000);
  if (interval.unref) interval.unref();
}

export function rateLimit(config: RateLimitConfig) {
  ensureCleanup(config.interval);

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(key) || { timestamps: [] };

      entry.timestamps = entry.timestamps.filter(
        t => now - t < config.interval
      );

      if (entry.timestamps.length >= config.maxRequests) {
        const oldest = entry.timestamps[0];
        const resetMs = config.interval - (now - oldest);
        return { success: false, remaining: 0, resetMs };
      }

      entry.timestamps.push(now);
      store.set(key, entry);

      return {
        success: true,
        remaining: config.maxRequests - entry.timestamps.length,
        resetMs: config.interval,
      };
    },
  };
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function rateLimitResponse(resetMs: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests', code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) },
    }
  );
}

// Pre-configured limiters
export const chatLimiter = rateLimit({ interval: 60_000, maxRequests: 20 });
export const ingestLimiter = rateLimit({ interval: 60_000, maxRequests: 30 }); // Increased from 10
export const modelsLimiter = rateLimit({ interval: 60_000, maxRequests: 30 });
export const verifyLimiter = rateLimit({ interval: 60_000, maxRequests: 20 }); // Increased from 5
export const generalLimiter = rateLimit({ interval: 60_000, maxRequests: 60 });
