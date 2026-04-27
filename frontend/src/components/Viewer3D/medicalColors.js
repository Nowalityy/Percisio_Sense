/**
 * Realistic medical color palette for segment labels. Basenames per set are generated
 * into `src/data/segmentSets.json` via `npm run build-segment-sets` (paths in `segmentAssets.js`).
 */
export const MEDICAL_COLORS = {
  heart: '#dc2626',
  liver: '#a16207',
  lung: '#ec4899',
  stomach: '#f97316',
  pancreas: '#eab308',
  spleen: '#991b1b',
  thyroid: '#f472b6',
  kidney: '#059669',
  adrenal: '#fbbf24',
  aorta: '#dc2626',
  artery: '#ef4444',
  vein: '#62C5EF', // BRAND: #62C5EF
  'inferior-vena-cava': '#2563eb',
  'superior-vena-cava': '#62C5EF', // BRAND: #62C5EF
  'brachiocephalic-trunk': '#f59e0b',
  'subclavian-artery': '#ef4444',
  'common-carotid-artery': '#dc2626',
  'brachiocephalic-vein': '#62C5EF', // BRAND: #62C5EF
  pulmonary: '#38bdf8',
  'pulmonary-venous-system': '#38bdf8',
  'portal-vein-and-splenic-vein': '#2563eb',
  'atrial-appendage': '#dc2626',
  trachea: '#cbd5e1',
  esophagus: '#fda4af',
  clavicle: '#ffffff',
  scapula: '#f8fafc',
  humerus: '#f1f5f9',
  sternum: '#ffffff',
  'spinal-cord': '#e2e8f0',
  muscle: '#991b1b',
  'deep-back-muscle': '#7f1d1d',
  skin: '#f9dfc5',
};

/**
 * Skin/envelope meshes — matched by name (`skinpercisio`, or any future export
 * containing the word "skin"). Centralized here so `Segment.jsx`, the filter
 * panel and color helpers stay in sync.
 * @param {string} name
 */
export function isSkinSegment(name) {
  if (!name) return false;
  return name.toLowerCase().includes('skin');
}

/**
 * @param {string} name — segment id (same as OBJ basename)
 */
export function getSegmentColor(name) {
  const n = name.toLowerCase().replace(/-/g, ' ');

  if (isSkinSegment(name)) return MEDICAL_COLORS.skin;
  if (n.includes('lung')) return MEDICAL_COLORS.lung;
  if (n.includes('kidney')) return MEDICAL_COLORS.kidney;
  if (n.includes('adrenal')) return MEDICAL_COLORS.adrenal;
  if (n.includes('atrial appendage')) return MEDICAL_COLORS['atrial-appendage'];
  if (n.includes('gallbladder')) return '#ca8a04';
  if (n.includes('urinary bladder')) return '#62C5EF'; // BRAND: #62C5EF
  if (n.includes('prostate')) return '#b45309';
  if (n.includes('thyroid')) return MEDICAL_COLORS.thyroid;
  if (n.includes('trachea')) return MEDICAL_COLORS.trachea;
  if (n.includes('esophagus')) return MEDICAL_COLORS.esophagus;
  if (n.includes('pancreas')) return MEDICAL_COLORS.pancreas;
  if (n.includes('spleen')) return MEDICAL_COLORS.spleen;
  if (n.includes('stomach')) return MEDICAL_COLORS.stomach;
  if (n.includes('aorta')) return MEDICAL_COLORS.aorta;
  if (n.includes('pulmonary')) return MEDICAL_COLORS.pulmonary;
  if (n.includes('portal vein') || n.includes('splenic vein')) return MEDICAL_COLORS['portal-vein-and-splenic-vein'];
  if (n.includes('vena cava')) return MEDICAL_COLORS.vein;
  if (n.includes('brachiocephalic trunk')) return MEDICAL_COLORS['brachiocephalic-trunk'];
  if (n.includes('subclavian') || n.includes('carotid')) {
    if (n.includes('vein')) return MEDICAL_COLORS['brachiocephalic-vein'];
    return MEDICAL_COLORS['common-carotid-artery'];
  }
  if (n.includes('brachiocephalic vein')) return MEDICAL_COLORS['brachiocephalic-vein'];
  if (n.includes('iliac')) {
    if (n.includes('artery')) return MEDICAL_COLORS.artery;
    if (n.includes('vein')) return MEDICAL_COLORS.vein;
  }
  if (n.includes('artery')) return MEDICAL_COLORS.artery;
  if (n.includes('vein')) return MEDICAL_COLORS.vein;
  if (n.includes('colon') || n.includes('duodenum') || n.includes('small bowel')) return '#d97706';
  if (n.includes('gluteus') || n.includes('iliopsoas') || n.includes('deep back muscle')) return MEDICAL_COLORS['deep-back-muscle'];
  if (
    n.includes('vertebra') ||
    n.includes('sacrum') ||
    n.includes('costal cartilage') ||
    /(left|right) rib \d/.test(n)
  ) {
    return MEDICAL_COLORS.humerus;
  }
  if (n.includes('femur')) return '#e2e8f0';
  if (n.includes('clavicle')) return MEDICAL_COLORS.clavicle;
  if (n.includes('scapula')) return MEDICAL_COLORS.scapula;
  if (n.includes('humerus')) return MEDICAL_COLORS.humerus;
  if (n.includes('sternum')) return MEDICAL_COLORS.sternum;
  if (n.includes('hip')) return '#e2e8f0';
  if (n.includes('spinal cord')) return MEDICAL_COLORS['spinal-cord'];

  for (const [key, color] of Object.entries(MEDICAL_COLORS)) {
    const k = key.replace(/-/g, ' ');
    if (n.includes(k)) return color;
  }
  return '#94a3b8';
}
