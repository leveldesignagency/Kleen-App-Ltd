type WindowEntry = { timestamps: number[] };

const store = new Map<string, WindowEntry>();
let blockedHits = 0;

function prune(entry: WindowEntry, now: number, windowMs: number) {
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
}

export type RateLimitResult =
  | { allowed: true; limit: number; remaining: number; resetAt: number }
  | { allowed: false; limit: number; remaining: 0; resetAt: number; retryAfterSec: number };

export function getRateLimitBlockedHits(): number {
  return blockedHits;
}

export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }
  prune(entry, now, windowMs);

  const oldest = entry.timestamps[0];
  const resetAt = oldest ? oldest + windowMs : now + windowMs;

  if (entry.timestamps.length >= max) {
    blockedHits += 1;
    return {
      allowed: false,
      limit: max,
      remaining: 0,
      resetAt,
      retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    limit: max,
    remaining: Math.max(0, max - entry.timestamps.length),
    resetAt,
  };
}
