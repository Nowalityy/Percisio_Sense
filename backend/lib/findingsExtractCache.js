/**
 * In-memory cache for MCP `extract_findings` (and local fallbacks) keyed by report body.
 * Avoids re-sending the full report through MCP on every follow-up chat message.
 */

import { createHash } from 'node:crypto';

const MAX_ENTRIES = 48;

/** @type {Map<string, unknown>} */
const cache = new Map();

export function hashReportContent(reportText) {
  return createHash('sha256').update(reportText, 'utf8').digest('hex');
}

/**
 * @param {string} key - sha256 hex from `hashReportContent`
 * @returns {unknown | null}
 */
export function getExtractFindingsCached(key) {
  const hit = cache.get(key);
  if (hit == null) return null;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

/**
 * @param {string} key
 * @param {unknown} value - MCP tool result shape `{ byOrgan, riskFlags, clinicalPriority, … }`
 */
export function setExtractFindingsCached(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest != null) cache.delete(oldest);
  }
}

/** @internal */
export function __clearExtractFindingsCacheForTests() {
  cache.clear();
}
