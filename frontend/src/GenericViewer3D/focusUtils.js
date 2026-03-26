/**
 * Focus/organ lookup: maps a focus key (e.g. "heart") to segment names and scene meshes.
 * Used by FocusCamera (zoom) and Segment (dimmed vs highlighted).
 */
import { SEGMENTS } from './medicalColors';

export const CATEGORY_MATCHES = {
  heart: ['heart', 'atrial-appendage'],
  liver: ['liver'],
  lung: ['lung'],
  lungs: ['lung'],
  'left lung': ['of-left-lung', 'left-lung'],
  'right lung': ['of-right-lung', 'right-lung'],
  stomach: ['stomach'],
  pancreas: ['pancreas'],
  spleen: ['spleen'],
  thyroid: ['thyroid'],
  aorta: ['aorta'],
  esophagus: ['esophagus'],
  trachea: ['trachea'],
  adrenal: ['adrenal-gland', 'adrenal'],
  kidney: ['kidney'],
  kidneys: ['kidney'],
  clavicle: ['clavicle'],
  scapula: ['scapula'],
  humerus: ['humerus'],
  sternum: ['sternum'],
  skeleton: ['clavicle', 'scapula', 'humerus', 'sternum', 'spinal-cord'],
  artery: ['artery', 'subclavian', 'carotid', 'aorta', 'brachiocephalic-trunk'],
  vein: ['vein', 'vena-cava', 'brachiocephalic-vein', 'portal-vein'],
  vessel: ['artery', 'vein', 'aorta', 'vena-cava', 'subclavian', 'carotid', 'brachiocephalic', 'portal-vein'],
  pulmonary: ['pulmonary'],
  muscle: ['muscle'],
  spinal: ['spinal-cord'],
  spine: ['spinal-cord'],
  'spinal-cord': ['spinal-cord'],
  trunk: ['brachiocephalic'],
  brachiocephalic: ['brachiocephalic'],
};

/** Backend / report may send these; map to canonical focus key for getSegmentNamesForFocus. */
const FOCUS_KEY_SYNONYMS = {
  coeur: 'heart',
  foie: 'liver',
  poumon: 'lung',
  poumons: 'lung',
  estomac: 'stomach',
  rate: 'spleen',
  thyroide: 'thyroid',
  trachée: 'trachea',
  trachee: 'trachea',
  œsophage: 'esophagus',
  oesophage: 'esophagus',
  rein: 'kidney',
  reins: 'kidney',
  surrenale: 'adrenal',
  'glande surrenale': 'adrenal',
};

function normalizeFocusKey(key) {
  if (!key || typeof key !== 'string') return key;
  const k = key.toLowerCase().trim();
  return FOCUS_KEY_SYNONYMS[k] ?? k;
}

/**
 * Map report card titles to focus keys (one-way); returns null if not a known organ.
 */
const CARD_TITLE_TO_FOCUS = {
  heart: 'heart',
  lungs: 'lung',
  liver: 'liver',
  stomach: 'stomach',
  pancreas: 'pancreas',
  spleen: 'spleen',
  thyroid: 'thyroid',
  aorta: 'aorta',
  esophagus: 'esophagus',
  trachea: 'trachea',
  adrenal: 'adrenal',
  kidney: 'kidney',
  kidneys: 'kidney',
  bones: 'clavicle',
  skeleton: 'clavicle',
  vessels: 'artery',
  pleura: 'lung',
  mediastinum: null,
  diaphragm: null,
  'spinal cord': 'spinal-cord',
  foie: 'liver',
  rate: 'spleen',
  pancréas: 'pancreas',
  pancreas: 'pancreas',
  reins: 'kidney',
  surrénales: 'adrenal',
  surrenales: 'adrenal',
  'vésicule biliaire': 'liver',
  'tube digestif': 'stomach',
  vascularisation: 'vessels',
  'structures osseuses': 'bones',
};

/**
 * Convert a report card title to a focus key for 3D zoom.
 * @param {string} title - e.g. "Heart", "Lungs", "Risks"
 * @returns {string | null}
 */
export function cardTitleToFocusKey(title) {
  if (!title || typeof title !== 'string') return null;
  const key = title.toLowerCase().trim();
  if (key === 'risks' || key === 'risques') return null;
  return CARD_TITLE_TO_FOCUS[key] ?? (CATEGORY_MATCHES[key] ? key : null);
}

/**
 * Returns segment names that belong to the given focus key.
 * @param {string} focusKey - e.g. "heart" → ["heart", "left-atrial-appendage"]
 * @returns {string[]}
 */
export function getSegmentNamesForFocus(focusKey) {
  if (!focusKey || typeof focusKey !== 'string') return [];
  const key = normalizeFocusKey(focusKey);
  return SEGMENTS.filter((seg) => {
    const n = seg.toLowerCase();
    if (n === key) return true;
    if (CATEGORY_MATCHES[key]?.some((kw) => n.includes(kw))) return true;
    if (n.includes(key) || key.includes(n)) return true;
    return false;
  });
}

/**
 * Returns true if the segment is part of the current focus (for highlighting).
 * @param {string} segmentName
 * @param {string} focusKey
 * @returns {boolean}
 */
export function isSegmentInFocus(segmentName, focusKey) {
  if (!focusKey || !segmentName) return false;
  return getSegmentNamesForFocus(focusKey).includes(segmentName);
}

/**
 * Finds all meshes in the scene whose name matches the focus key.
 * @param {THREE.Scene} scene
 * @param {string} focusName
 * @returns {THREE.Mesh[]}
 */
export function findOrganMeshes(scene, focusName) {
  if (!scene || !focusName || typeof focusName !== 'string') return [];
  const segmentNames = getSegmentNamesForFocus(focusName);
  if (segmentNames.length === 0) return [];
  const result = [];
  const namesSet = new Set(segmentNames.map((s) => s.toLowerCase()));
  scene.traverse((child) => {
    if (!child.isMesh || !child.name) return;
    const n = child.name.toLowerCase();
    if (namesSet.has(n)) {
      result.push(child);
      return;
    }
    if (segmentNames.some((seg) => n.includes(seg.toLowerCase()))) result.push(child);
  });
  return result;
}
