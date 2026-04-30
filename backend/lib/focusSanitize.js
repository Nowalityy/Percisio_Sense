/**
 * Canonical focus keys + LLM output sanitization (must match frontend focusUtils).
 */

export const FOCUS_KEYS = [
  'lung',
  'lungs',
  'left lung',
  'right lung',
  'heart',
  'liver',
  'stomach',
  'pancreas',
  'spleen',
  'thyroid',
  'esophagus',
  'trachea',
  'aorta',
  'kidney',
  'kidneys',
  'left kidney',
  'right kidney',
  'adrenal',
  'left adrenal',
  'right adrenal',
  'colon',
  'duodenum',
  'gallbladder',
  'small bowel',
  'urinary bladder',
  'bladder',
  'prostate',
  'spinal-cord',
  'cervical spine',
  'thoracic spine',
  'lumbar spine',
  'skeleton',
  'bones',
  'clavicle',
  'scapula',
  'humerus',
  'sternum',
  'muscle',
  'iliopsoas',
  'artery',
  'vein',
  'vessel',
  'pulmonary',
  'brachiocephalic',
  'trunk',
  'portal vein',
  'carotid',
  'subclavian',
  'vena cava',
  'brachiocephalic vein',
  'mediastinum',
  'diaphragm',
  'pleura',
  'iliac',
  'femur',
  'hip',
  'gluteus',
  'rib',
  'ribs',
  'vertebra',
  'vertebrae',
  'sacrum',
  'costal cartilage',
];

const FOCUS_KEYS_SET = new Set(FOCUS_KEYS);

/** Legacy mesh-style names from older prompts → canonical focus key. */
const LEGACY_LLM_FOCUS_MAP = {
  heart: 'heart',
  liver: 'liver',
  'inferior-lobe-of-left-lung': 'left lung',
  'inferior-lobe-of-right-lung': 'right lung',
  'superior-lobe-of-left-lung': 'left lung',
  'superior-lobe-of-right-lung': 'right lung',
  'middle-lobe-of-right-lung': 'right lung',
  'left-atrial-appendage': 'heart',
  'brachiocephalic-trunk': 'brachiocephalic',
  'inferior-vena-cava': 'vena cava',
  'superior-vena-cava': 'vena cava',
  'portal-vein-and-splenic-vein': 'portal vein',
  'pulmonary-venous-system': 'pulmonary',
  'spinal-cord': 'spinal-cord',
  skinpercisio: 'skin',
  'left-kidney': 'left kidney',
  'right-kidney': 'right kidney',
  'left-adrenal-gland': 'left adrenal',
  'right-adrenal-gland': 'right adrenal',
  'common-carotid-artery': 'carotid',
  'left-common-carotid-artery': 'carotid',
  'right-common-carotid-artery': 'carotid',
  'left-subclavian-artery': 'subclavian',
  'right-subclavian-artery': 'subclavian',
  'left-brachiocephalic-vein': 'brachiocephalic vein',
  'right-brachiocephalic-vein': 'brachiocephalic vein',
};

function normalizeFocusToken(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VERT_LETTER_MAX = { c: 7, t: 12, l: 5, s: 5 };

/**
 * Parse "c7", "t12 vertebra", "vertèbre 7" → canonical `c7 vertebra` keys used by mesh names.
 * @param {string} lower - lowercased, whitespace-normalized text
 * @returns {string | null}
 */
function tryParseVertebraLower(lower) {
  let m = lower.match(/\b([ctls])\s*-?\s*(\d{1,2})\s*(?:vertebra|vertebre|vertèbre)?\b/);
  if (m) {
    const letter = m[1].toLowerCase();
    const num = parseInt(m[2], 10);
    const max = VERT_LETTER_MAX[letter];
    if (!max || num < 1 || num > max) return null;
    return `${letter}${num} vertebra`;
  }

  m = lower.match(/\b(?:vert[eè]bre|vertebra)s?\s+(?:n[o°]?\s*)?(\d{1,2})\b/);
  if (m) {
    const num = parseInt(m[1], 10);
    // "vertèbre 7" / "vertebra 7" — par défaut cervicales C1–C7 (cas le plus demandé en chat)
    if (num >= 1 && num <= 7) return `c${num} vertebra`;
    return null;
  }

  m = lower.match(/\b(\d{1,2})\s*(?:ère|ere|er|e)?\s*(?:vert[eè]bre|vertebra)\b/);
  if (m) {
    const num = parseInt(m[1], 10);
    if (num >= 1 && num <= 7) return `c${num} vertebra`;
    return null;
  }

  if (/^[ctls]\d+\s+vertebra$/.test(lower)) {
    m = lower.match(/^([ctls])(\d+)\s+vertebra$/);
    if (m) {
      const letter = m[1].toLowerCase();
      const num = parseInt(m[2], 10);
      const max = VERT_LETTER_MAX[letter];
      if (max && num >= 1 && num <= max) return `${letter}${num} vertebra`;
    }
  }

  return null;
}

/**
 * Extract a canonical vertebra focus key from free text (English/French).
 * @param {string} rawText
 * @returns {string | null}
 */
export function extractVertebraFocusFromPlainText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const lower = normalizeFocusToken(rawText);
  return tryParseVertebraLower(lower);
}

/**
 * Maps LLM `focus` output to an allowed key, or null.
 * @param {unknown} focus
 * @returns {string | null}
 */
export function sanitizeLlmFocus(focus) {
  if (focus == null) return null;
  if (typeof focus !== 'string') return null;
  const trimmed = focus.trim();
  if (!trimmed) return null;
  const lower = normalizeFocusToken(trimmed);
  const vertebra = tryParseVertebraLower(lower);
  if (vertebra) return vertebra;
  if (/^[ctls]\d{1,2}$/.test(lower)) {
    const expanded = tryParseVertebraLower(`${lower} vertebra`);
    if (expanded) return expanded;
  }
  if (FOCUS_KEYS_SET.has(lower)) return lower;
  if (Object.prototype.hasOwnProperty.call(LEGACY_LLM_FOCUS_MAP, lower)) {
    const mapped = LEGACY_LLM_FOCUS_MAP[lower];
    return mapped && FOCUS_KEYS_SET.has(mapped) ? mapped : null;
  }
  const legacyHyphen = lower.replace(/\s+/g, '-');
  if (Object.prototype.hasOwnProperty.call(LEGACY_LLM_FOCUS_MAP, legacyHyphen)) {
    const mapped = LEGACY_LLM_FOCUS_MAP[legacyHyphen];
    return mapped && FOCUS_KEYS_SET.has(mapped) ? mapped : null;
  }
  for (const k of FOCUS_KEYS) {
    if (k === lower || k.replace(/-/g, ' ') === lower) return k;
  }
  return null;
}
