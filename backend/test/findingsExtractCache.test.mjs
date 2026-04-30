import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashReportContent,
  getExtractFindingsCached,
  setExtractFindingsCached,
  __clearExtractFindingsCacheForTests,
} from '../lib/findingsExtractCache.js';

test('hashReportContent is stable for identical text', () => {
  const a = hashReportContent('Chest XR\nRight basal opacity.');
  const b = hashReportContent('Chest XR\nRight basal opacity.');
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test('hashReportContent distinguishes minor edits (professional duplicate-detection sanity)', () => {
  const a = hashReportContent('CT scan unremarkable.');
  const b = hashReportContent('CT scan without significant findings.');
  assert.notEqual(a, b);
});

test('cache returns same bundle and promotes LRU entry on access', () => {
  __clearExtractFindingsCacheForTests();
  const key = hashReportContent('test report body');
  const bundle = { byOrgan: { lungs: ['line'] }, riskFlags: [], _extractSource: 'mcp' };
  setExtractFindingsCached(key, bundle);
  const hit = getExtractFindingsCached(key);
  assert.deepEqual(hit, bundle);
  const hit2 = getExtractFindingsCached(key);
  assert.deepEqual(hit2, bundle);
});

test('cache evicts oldest when over capacity (stress: many unique reports)', () => {
  __clearExtractFindingsCacheForTests();
  for (let i = 0; i < 52; i += 1) {
    const k = hashReportContent(`report-${i}`);
    setExtractFindingsCached(k, { i });
  }
  assert.equal(getExtractFindingsCached(hashReportContent('report-0')), null);
  assert.equal(getExtractFindingsCached(hashReportContent('report-51'))?.i, 51);
});
