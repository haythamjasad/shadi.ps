const buckets = new Map();

function pruneBucket(bucket, now, windowMs) {
  while (bucket.length > 0 && now - bucket[0] >= windowMs) {
    bucket.shift();
  }
}

export function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').trim();
  if (forwarded) {
    const [first] = forwarded.split(',');
    if (first) return first.trim();
  }
  return String(req.ip || req.socket?.remoteAddress || 'unknown').trim() || 'unknown';
}

export function takeRateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const normalizedKey = String(key || '').trim() || 'anonymous';
  const bucket = buckets.get(normalizedKey) || [];

  pruneBucket(bucket, now, windowMs);
  if (bucket.length >= limit) {
    const retryAfterMs = Math.max(windowMs - (now - bucket[0]), 1000);
    buckets.set(normalizedKey, bucket);
    return { ok: false, retryAfterMs };
  }

  bucket.push(now);
  buckets.set(normalizedKey, bucket);
  return { ok: true, remaining: Math.max(limit - bucket.length, 0) };
}
