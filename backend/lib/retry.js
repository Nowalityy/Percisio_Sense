/**
 * Retry transient failures with exponential backoff + jitter.
 *
 * Pure and dependency-free so it is unit-testable: the sleep function is
 * injectable (tests pass a no-op to avoid real timers).
 */

/** Default classifier: retry on 429, 5xx, and connection timeouts. */
export function isRetryableError(err) {
  const status = err?.status ?? err?.response?.status;
  return (
    status === 429 ||
    (typeof status === 'number' && status >= 500) ||
    err?.code === 'ETIMEDOUT' ||
    err?.name === 'APIConnectionTimeoutError'
  );
}

/**
 * @param {() => Promise<T>} fn - the operation to attempt
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=2] - additional attempts after the first
 * @param {(attempt: number) => number} [opts.backoffMs] - delay before retry N (0-indexed)
 * @param {(err: unknown) => boolean} [opts.isRetryable]
 * @param {(ms: number) => Promise<void>} [opts.sleep]
 * @param {(info: {attempt:number,delayMs:number,error:unknown}) => void} [opts.onRetry]
 * @returns {Promise<T>}
 * @template T
 */
export async function withRetry(fn, opts = {}) {
  const maxRetries = Number.isInteger(opts.maxRetries) ? opts.maxRetries : 2;
  const isRetryable = opts.isRetryable ?? isRetryableError;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const backoffMs = opts.backoffMs ?? ((attempt) => 400 * 2 ** attempt + Math.floor(Math.random() * 200));

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxRetries) break;
      const delayMs = backoffMs(attempt);
      opts.onRetry?.({ attempt: attempt + 1, delayMs, error: err });
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
