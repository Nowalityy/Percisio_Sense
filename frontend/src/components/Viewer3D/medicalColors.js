/**
 * Realistic medical color palette — filenames must match `public/models/segments/*.obj` exactly.
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
  segment_1: '#f9dfc5',
};

/**
 * @param {string} name — segment id (same as OBJ basename)
 */
export function getSegmentColor(name) {
  const n = name.toLowerCase().replace(/-/g, ' ');

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

/** Basenames of `public/models/segments/*.obj` (must stay in sync with files on disk). */
export const SEGMENTS = [
  'aorta',
  'brachiocephalic trunk',
  'C5 vertebra',
  'C6 vertebra',
  'C7 vertebra',
  'colon',
  'costal cartilage',
  'duodenum',
  'esophagus',
  'gallbladder',
  'inferior lobe of left lung',
  'inferior lobe of right lung',
  'inferior vena cava',
  'L1 vertebra',
  'L2 vertebra',
  'L3 vertebra',
  'L4 vertebra',
  'L5 vertebra',
  'left adrenal gland',
  'left atrial appendage',
  'left brachiocephalic vein',
  'left clavicle',
  'left common carotid artery',
  'left common iliac artery',
  'left common iliac vein',
  'left deep back muscle',
  'left femur',
  'left gluteus maximus',
  'left gluteus medius',
  'left gluteus minimus',
  'left hip',
  'left humerus',
  'left iliopsoas muscle',
  'left kidney',
  'left rib 1',
  'left rib 10',
  'left rib 11',
  'left rib 12',
  'left rib 2',
  'left rib 3',
  'left rib 4',
  'left rib 5',
  'left rib 6',
  'left rib 7',
  'left rib 8',
  'left rib 9',
  'left scapula',
  'left subclavian artery',
  'middle lobe of right lung',
  'pancreas',
  'portal vein and splenic vein',
  'prostate',
  'pulmonary venous system',
  'right adrenal gland',
  'right brachiocephalic vein',
  'right clavicle',
  'right common carotid artery',
  'right common iliac artery',
  'right common iliac vein',
  'right deep back muscle',
  'right femur',
  'right gluteus maximus',
  'right gluteus medius',
  'right gluteus minimus',
  'right hip',
  'right humerus',
  'right iliopsoas muscle',
  'right kidney',
  'right rib 1',
  'right rib 10',
  'right rib 11',
  'right rib 12',
  'right rib 2',
  'right rib 3',
  'right rib 4',
  'right rib 5',
  'right rib 6',
  'right rib 7',
  'right rib 8',
  'right rib 9',
  'right scapula',
  'right subclavian artery',
  'S1 vertebra',
  'Sacrum',
  'small bowel',
  'spinal cord',
  'spleen',
  'sternum',
  'stomach',
  'superior lobe of left lung',
  'superior lobe of right lung',
  'superior vena cava',
  'T1 vertebra',
  'T10 vertebra',
  'T11 vertebra',
  'T12 vertebra',
  'T2 vertebra',
  'T3 vertebra',
  'T4 vertebra',
  'T5 vertebra',
  'T6 vertebra',
  'T7 vertebra',
  'T8 vertebra',
  'T9 vertebra',
  'thyroid',
  'trachea',
  'urinary bladder',
];
