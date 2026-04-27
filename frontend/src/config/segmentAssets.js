/**
 * Anatomy OBJ/MTL live under `public/models/segments/<set>/` and the same path on the CDN.
 * The active set id comes from the scene store (`anatomySegmentSet`).
 */
import { getDefaultAnatomySetId } from '../segmentList';

/**
 * Base URL for segment OBJ/MTL with no trailing slash.
 *
 * - **Default (empty):** URLs are `/models/segments/...` (same origin).
 *   - Dev: Vite serves `public/models/segments/`.
 *   - Prod (e.g. Vercel): configure a rewrite proxy to your R2 bucket (see `vercel.json`).
 *     Direct browser loads from `*.r2.dev` often fail: R2 public buckets omit CORS, and
 *     Three.js loaders need a readable cross-origin response.
 *
 * - **Override:** set `VITE_MODELS_BASE_URL` to a full origin (e.g. your CDN) **and** enable
 *   CORS on that bucket (`GET`, `HEAD`, `OPTIONS`, `Access-Control-Allow-Origin`).
 */
export function getModelsBaseUrl() {
  const raw = import.meta.env.VITE_MODELS_BASE_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.replace(/\/+$/, '');
  }
  return '';
}

/**
 * Path relative to site root (after optional CDN base): `models/segments/<set>/name.ext`
 * @param {string} name – OBJ basename (no extension)
 * @param {string} ext – e.g. '.obj' or '.mtl'
 * @param {string} [setDir] – folder under `public/models/segments/`
 */
export function segmentModelRelativePath(name, ext, setDir) {
  const dir = setDir || getDefaultAnatomySetId();
  return `models/segments/${dir}/${encodeURIComponent(name)}${ext}`;
}

/**
 * Absolute URL for loaders and prefetch (leading slash when same-origin).
 */
export function segmentAbsoluteUrl(name, ext, setDir) {
  const rel = segmentModelRelativePath(name, ext, setDir);
  const base = getModelsBaseUrl();
  if (!base) return `/${rel}`;
  return `${base}/${rel}`;
}
