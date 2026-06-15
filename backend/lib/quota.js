/**
 * Per-user daily request quota (in-memory).
 *
 * Until the app has authentication, "user" = client IP. This sits on top of
 * the burst rate-limiter: the rate-limiter caps requests per 15 min, the
 * quota caps total requests per rolling 24h window so a single client cannot
 * silently burn the OpenAI budget all day.
 *
 * In-memory and per-process — fine for a single instance. For horizontal
 * scaling, back this with Redis (same interface).
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();
let lastSweep = 0;

/** Drop expired buckets occasionally so the map cannot grow unbounded. */
function sweep(now) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Record one hit for `key` and report quota state.
 * @param {string} key
 * @param {number} limit - max hits per 24h window
 * @param {number} [now=Date.now()]
 * @returns {{ allowed: boolean, remaining: number, limit: number, resetAt: number, count: number }}
 */
export function consumeQuota(key, limit, now = Date.now()) {
  sweep(now);
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    limit,
    resetAt: bucket.resetAt,
    count: bucket.count,
  };
}

/** @internal test helper */
export function __resetQuota() {
  buckets.clear();
  lastSweep = 0;
}

/**
 * Express middleware enforcing a daily per-IP quota.
 * @param {object} [opts]
 * @param {number} [opts.limit] - defaults to USER_DAILY_QUOTA env or 250
 * @param {(req) => string} [opts.keyOf] - identity extractor (default: req.ip)
 * @param {import('./logger.js').logger} [opts.log]
 */
export function dailyQuota(opts = {}) {
  const envLimit = Number(process.env.USER_DAILY_QUOTA);
  const limit = opts.limit ?? (Number.isFinite(envLimit) && envLimit > 0 ? envLimit : 250);
  const keyOf = opts.keyOf ?? ((req) => req.ip || req.socket?.remoteAddress || 'unknown');
  return (req, res, next) => {
    const key = keyOf(req);
    const state = consumeQuota(key, limit);
    res.setHeader('X-Quota-Limit', String(state.limit));
    res.setHeader('X-Quota-Remaining', String(state.remaining));
    res.setHeader('X-Quota-Reset', String(Math.ceil(state.resetAt / 1000)));
    if (!state.allowed) {
      opts.log?.warn?.('daily quota exceeded', { key, count: state.count, limit: state.limit });
      const retryAfterSec = Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Daily request quota reached. Please try again later.',
      });
    }
    next();
  };
}
