import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLlmFocus } from '../lib/focusSanitize.js';

describe('sanitizeLlmFocus', () => {
  it('returns null for non-strings and empty', () => {
    assert.equal(sanitizeLlmFocus(null), null);
    assert.equal(sanitizeLlmFocus(undefined), null);
    assert.equal(sanitizeLlmFocus(''), null);
    assert.equal(sanitizeLlmFocus('   '), null);
    assert.equal(sanitizeLlmFocus(123), null);
  });

  it('accepts canonical keys', () => {
    assert.equal(sanitizeLlmFocus('heart'), 'heart');
    assert.equal(sanitizeLlmFocus('left lung'), 'left lung');
    assert.equal(sanitizeLlmFocus('vena cava'), 'vena cava');
  });

  it('maps legacy hyphenated slugs', () => {
    assert.equal(sanitizeLlmFocus('inferior-vena-cava'), 'vena cava');
    assert.equal(sanitizeLlmFocus('left-atrial-appendage'), 'heart');
  });

  it('returns null for unknown focus', () => {
    assert.equal(sanitizeLlmFocus('not-an-organ'), null);
    assert.equal(sanitizeLlmFocus('brain'), null);
  });
});
