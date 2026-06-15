import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, isRetryableError } from '../lib/retry.js';

const noSleep = () => Promise.resolve();

describe('isRetryableError', () => {
  it('retries 429 and 5xx and connection timeouts', () => {
    assert.equal(isRetryableError({ status: 429 }), true);
    assert.equal(isRetryableError({ status: 503 }), true);
    assert.equal(isRetryableError({ code: 'ETIMEDOUT' }), true);
    assert.equal(isRetryableError({ name: 'APIConnectionTimeoutError' }), true);
  });

  it('does not retry 4xx (except 429) or unknown errors', () => {
    assert.equal(isRetryableError({ status: 400 }), false);
    assert.equal(isRetryableError({ status: 401 }), false);
    assert.equal(isRetryableError(new Error('boom')), false);
  });
});

describe('withRetry', () => {
  it('returns immediately on first success', async () => {
    let calls = 0;
    const out = await withRetry(async () => { calls += 1; return 'ok'; }, { sleep: noSleep });
    assert.equal(out, 'ok');
    assert.equal(calls, 1);
  });

  it('retries retryable failures then succeeds', async () => {
    let calls = 0;
    const retries = [];
    const out = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw { status: 503 };
        return 'recovered';
      },
      { sleep: noSleep, onRetry: (i) => retries.push(i.attempt) }
    );
    assert.equal(out, 'recovered');
    assert.equal(calls, 3);
    assert.deepEqual(retries, [1, 2]);
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => { calls += 1; throw { status: 400 }; }, { sleep: noSleep }),
      (e) => e.status === 400
    );
    assert.equal(calls, 1);
  });

  it('gives up after maxRetries and throws the last error', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => { calls += 1; throw { status: 500, attempt: calls }; }, {
        sleep: noSleep,
        maxRetries: 2,
      }),
      (e) => e.attempt === 3
    );
    assert.equal(calls, 3); // 1 initial + 2 retries
  });
});
