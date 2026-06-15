import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { consumeQuota, dailyQuota, __resetQuota } from '../lib/quota.js';

/** Minimal Express-like req/res doubles for middleware tests. */
function mockReqRes(ip = '9.9.9.9') {
  const headers = {};
  let statusCode = 200;
  let body = null;
  let nexted = false;
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status: (c) => { statusCode = c; return res; },
    json: (b) => { body = b; return res; },
    get headers() { return headers; },
    get statusCode() { return statusCode; },
    get body() { return body; },
    get nexted() { return nexted; },
  };
  return { req: { ip }, res, next: () => { nexted = true; } };
}

describe('consumeQuota', () => {
  beforeEach(() => __resetQuota());

  it('counts hits and reports remaining', () => {
    const a = consumeQuota('1.2.3.4', 3);
    assert.equal(a.allowed, true);
    assert.equal(a.remaining, 2);
    const b = consumeQuota('1.2.3.4', 3);
    assert.equal(b.remaining, 1);
  });

  it('blocks once the limit is exceeded', () => {
    consumeQuota('ip', 2);
    consumeQuota('ip', 2);
    const third = consumeQuota('ip', 2);
    assert.equal(third.allowed, false);
    assert.equal(third.remaining, 0);
  });

  it('tracks separate keys independently', () => {
    consumeQuota('a', 1);
    const blockedA = consumeQuota('a', 1);
    const freshB = consumeQuota('b', 1);
    assert.equal(blockedA.allowed, false);
    assert.equal(freshB.allowed, true);
  });

  it('resets after the window elapses', () => {
    const now = 1_000_000;
    consumeQuota('ip', 1, now);
    assert.equal(consumeQuota('ip', 1, now).allowed, false);
    // 24h + 1ms later → fresh window
    const later = now + 24 * 60 * 60 * 1000 + 1;
    const after = consumeQuota('ip', 1, later);
    assert.equal(after.allowed, true);
    assert.equal(after.count, 1);
  });
});

describe('dailyQuota middleware', () => {
  beforeEach(() => __resetQuota());

  it('allows with a numeric default limit when no env/opts are set (regression: NaN limit blocked everything)', () => {
    delete process.env.USER_DAILY_QUOTA;
    const mw = dailyQuota();
    const { req, res, next } = mockReqRes('1.1.1.1');
    mw(req, res, next);
    assert.equal(res.nexted, true);
    assert.equal(res.headers['X-Quota-Limit'], '250');
    assert.equal(Number.isNaN(Number(res.headers['X-Quota-Remaining'])), false);
  });

  it('honours an explicit limit and 429s past it', () => {
    const mw = dailyQuota({ limit: 2 });
    const hit = () => { const m = mockReqRes('2.2.2.2'); mw(m.req, m.res, m.next); return m; };
    assert.equal(hit().res.nexted, true);
    assert.equal(hit().res.nexted, true);
    const third = hit();
    assert.equal(third.res.nexted, false);
    assert.equal(third.res.statusCode, 429);
    assert.match(third.res.body.error, /quota/i);
  });
});
