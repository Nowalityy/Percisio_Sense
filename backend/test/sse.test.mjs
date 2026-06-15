import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sseEvent, SSE_DONE } from '../lib/sse.js';

describe('sseEvent', () => {
  it('serializes a frame as `data: <json>\\n\\n`', () => {
    const frame = sseEvent({ type: 'delta', text: 'hello' });
    assert.equal(frame, 'data: {"type":"delta","text":"hello"}\n\n');
  });

  it('round-trips through the client parsing convention', () => {
    const frame = sseEvent({ type: 'final', focus: 'liver', cards: [] });
    assert.ok(frame.startsWith('data: '));
    assert.ok(frame.endsWith('\n\n'));
    const json = frame.slice(5, -2).trim();
    const parsed = JSON.parse(json);
    assert.equal(parsed.type, 'final');
    assert.equal(parsed.focus, 'liver');
    assert.deepEqual(parsed.cards, []);
  });

  it('escapes newlines inside payload text (frame stays single-event)', () => {
    const frame = sseEvent({ type: 'delta', text: 'line1\nline2' });
    // Only the trailing delimiter should contain a real double newline.
    assert.equal(frame.indexOf('\n\n'), frame.length - 2);
  });

  it('SSE_DONE is the terminal frame', () => {
    assert.equal(SSE_DONE, 'data: [DONE]\n\n');
  });
});
