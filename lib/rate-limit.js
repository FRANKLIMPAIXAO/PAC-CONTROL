const buckets = new Map();

function cleanupExpired(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function takeRateLimit(key, limit, windowMs) {
  const now = Date.now();
  cleanupExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSec: 0,
  };
}

export function resetRateLimit(key) {
  buckets.delete(key);
}
