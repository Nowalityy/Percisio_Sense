/**
 * Anatomy OBJ/MTL live under `public/models/segments/<set>/` and the same path on the CDN.
 * The active set id comes from the scene store (`anatomySegmentSet`).
 */
import { getDefaultAnatomySetId } from '../segmentList';

/** Public R2 bucket (same layout as `public/models/segments/`). Used when env is unset in production builds (e.g. Vercel). */
const MODELS_CDN_DEFAULT = 'https://pub-4cafc161d51047b8b22ca1a006be74b3.r2.dev';

/**
 * Base URL for segment OBJ/MTL with no trailing slash.
 * - Dev: empty → URLs are root-relative (`/models/segments/...`) served from Vite `public/`.
 * - Prod: `VITE_MODELS_BASE_URL` or {@link MODELS_CDN_DEFAULT} (segments are not in git on deploy).
 */
export function getModelsBaseUrl() {
  const raw = import.meta.env.VITE_MODELS_BASE_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.replace(/\/+$/, '');
  }
  if (import.meta.env.PROD) {
    return MODELS_CDN_DEFAULT;
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
