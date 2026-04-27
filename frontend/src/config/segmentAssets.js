/**
 * Anatomy OBJ/MTL live under `public/models/segments/<set>/` and the same path on the CDN.
 * The active set id comes from the scene store (`anatomySegmentSet`).
 */
import { getDefaultAnatomySetId } from '../segmentList';

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
