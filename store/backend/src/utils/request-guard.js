const buckets = new Map();

function pruneBucket(bucket, now, windowMs) {
  while (bucket.length > 0 && now - bucket[0] >= windowMs) {
    bucket.shift();
  }
}

export function getClientIp(req) {
  const trustProxy = req.app?.get?.('trust proxy');
  const candidate = trustProxy
    ? req.ip
    : req.socket?.remoteAddress;
  const normalized = String(candidate || 'unknown').trim();
  return normalized.replace(/^::ffff:/, '') || 'unknown';
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
