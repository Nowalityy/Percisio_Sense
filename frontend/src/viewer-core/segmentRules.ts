const MODE_MATCHERS: Record<string, RegExp> = {
  Skeleton: /(vertebra|rib|clavicle|scapula|humerus|sternum|sacrum|hip|femur)/,
  Organs:
    /(heart|liver|lung|stomach|pancreas|spleen|thyroid|kidney|colon|duodenum|gallbladder|esophagus|trachea)/,
  Vessels: /(aorta|artery|vein|vena|brachiocephalic|carotid|subclavian|portal|pulmonary)/,
};

const THORACIC_VERTEBRA_KEYWORDS = Array.from(
  { length: 12 },
  (_, i) => `t${i + 1} vertebra`
);
const LUMBAR_VERTEBRA_KEYWORDS = [
  'l1 vertebra',
  'l2 vertebra',
  'l3 vertebra',
  'l4 vertebra',
  'l5 vertebra',
];

export const SEGMENT_CATEGORIES = {
  organs: {
    label: 'Organs',
    keywords: [
      'heart',
      'liver',
      'lung',
      'stomach',
      'pancreas',
      'spleen',
      'thyroid',
      'adrenal',
      'esophagus',
      'trachea',
    ],
  },
  bones: {
    label: 'Bones',
    keywords: ['clavicle', 'scapula', 'humerus', 'sternum', 'spinal-cord'],
  },
  vessels: {
    label: 'Vessels',
    keywords: [
      'aorta',
      'artery',
      'vein',
      'vena',
      'cava',
      'brachiocephalic',
      'carotid',
      'subclavian',
      'pulmonary',
      'portal',
    ],
  },
  muscles: {
    label: 'Muscles',
    keywords: ['muscle'],
  },
  other: {
    label: 'Other',
    keywords: ['segment_1'],
  },
} as const;

export const CATEGORY_MATCHES: Record<string, string[]> = {
  heart: ['atrial appendage', 'atrial-appendage'],
  liver: ['gallbladder', 'liver'],
  lung: ['lung'],
  lungs: ['lung'],
  'left lung': ['of left lung', 'left lung', 'of-left-lung', 'left-lung'],
  'right lung': ['of right lung', 'right lung', 'of-right-lung', 'right-lung'],
  stomach: ['stomach'],
  pancreas: ['pancreas'],
  spleen: ['spleen'],
  thyroid: ['thyroid'],
  aorta: ['aorta'],
  esophagus: ['esophagus'],
  trachea: ['trachea'],
  adrenal: ['adrenal-gland', 'adrenal'],
  'left kidney': ['left kidney'],
  'right kidney': ['right kidney'],
  'left adrenal': ['left adrenal'],
  'right adrenal': ['right adrenal'],
  kidney: ['kidney'],
  kidneys: ['kidney'],
  colon: ['colon'],
  duodenum: ['duodenum'],
  gallbladder: ['gallbladder'],
  'small bowel': ['small bowel', 'bowel'],
  bowel: ['small bowel', 'bowel', 'colon'],
  'urinary bladder': ['urinary bladder', 'bladder'],
  bladder: ['urinary bladder', 'bladder'],
  prostate: ['prostate'],
  'portal vein': ['portal vein', 'splenic vein', 'portal-vein', 'splenic-vein'],
  portal: ['portal vein', 'splenic vein'],
  clavicle: ['clavicle'],
  scapula: ['scapula'],
  humerus: ['humerus'],
  sternum: ['sternum'],
  femur: ['femur'],
  hip: ['hip'],
  gluteus: ['gluteus'],
  iliac: ['iliac'],
  rib: ['rib'],
  ribs: ['rib'],
  vertebra: ['vertebra'],
  vertebrae: ['vertebra'],
  sacrum: ['sacrum', 's1 vertebra'],
  'costal cartilage': ['costal cartilage'],
  'cervical spine': ['c5 vertebra', 'c6 vertebra', 'c7 vertebra'],
  'thoracic spine': THORACIC_VERTEBRA_KEYWORDS,
  'lumbar spine': LUMBAR_VERTEBRA_KEYWORDS,
  carotid: ['common carotid', 'carotid'],
  subclavian: ['subclavian'],
  'vena cava': ['vena cava'],
  'brachiocephalic vein': ['brachiocephalic vein'],
  iliopsoas: ['iliopsoas'],
  skeleton: [
    'clavicle',
    'scapula',
    'humerus',
    'sternum',
    'spinal-cord',
    'spinal cord',
    'rib',
    'vertebra',
    'sacrum',
    'femur',
    'cartilage',
    'hip',
    'costal cartilage',
  ],
  artery: ['artery', 'subclavian', 'carotid', 'aorta', 'iliac'],
  vein: ['vein', 'vena-cava', 'brachiocephalic-vein', 'portal-vein', 'iliac'],
  vessel: [
    'artery',
    'vein',
    'aorta',
    'vena-cava',
    'subclavian',
    'carotid',
    'brachiocephalic',
    'portal-vein',
  ],
  pulmonary: ['pulmonary'],
  muscle: ['muscle', 'iliopsoas', 'deep back muscle', 'gluteus'],
  spinal: ['spinal-cord', 'spinal cord'],
  spine: ['spinal-cord', 'spinal cord', 'vertebra'],
  'spinal-cord': ['spinal-cord', 'spinal cord'],
  trunk: ['brachiocephalic', 'brachiocephalic trunk'],
  brachiocephalic: ['brachiocephalic', 'brachiocephalic trunk'],
  mediastinum: ['aorta', 'trachea', 'esophagus', 'atrial appendage', 'pulmonary'],
  diaphragm: ['lung', 'lobe'],
  pleura: ['lung', 'lobe', 'pleural'],
};

const FOCUS_KEY_SYNONYMS: Record<string, string> = {
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
  côlon: 'colon',
  colon: 'colon',
  vessie: 'bladder',
  prostate: 'prostate',
  duodenum: 'duodenum',
  intestin: 'small bowel',
  'intestin grêle': 'small bowel',
  vesicule: 'gallbladder',
  'vésicule biliaire': 'gallbladder',
  'rachis cervical': 'cervical spine',
  'rachis thoracique': 'thoracic spine',
  'rachis lombaire': 'lumbar spine',
  'veine cave': 'vena cava',
  carotide: 'carotid',
  psoas: 'iliopsoas',
};

const CARD_TITLE_TO_FOCUS: Record<string, string | null> = {
  heart: 'heart',
  lungs: 'lung',
  lung: 'lung',
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
  colon: 'colon',
  duodenum: 'duodenum',
  gallbladder: 'gallbladder',
  bladder: 'bladder',
  prostate: 'prostate',
  'small bowel': 'small bowel',
  bowel: 'small bowel',
  bones: 'skeleton',
  skeleton: 'skeleton',
  vessels: 'vessel',
  pleura: 'lung',
  mediastinum: 'mediastinum',
  diaphragm: 'diaphragm',
  'spinal cord': 'spinal-cord',
  'left kidney': 'left kidney',
  'right kidney': 'right kidney',
  'left adrenal': 'left adrenal',
  'right adrenal': 'right adrenal',
  'cervical spine': 'cervical spine',
  'thoracic spine': 'thoracic spine',
  'lumbar spine': 'lumbar spine',
  carotid: 'carotid',
  subclavian: 'subclavian',
  'vena cava': 'vena cava',
  'brachiocephalic vein': 'brachiocephalic vein',
  iliopsoas: 'iliopsoas',
  foie: 'liver',
  rate: 'spleen',
  pancréas: 'pancreas',
  reins: 'kidney',
  surrénales: 'adrenal',
  surrenales: 'adrenal',
  'vésicule biliaire': 'gallbladder',
  'tube digestif': 'stomach',
  vascularisation: 'vessel',
  'structures osseuses': 'skeleton',
  other: null,
  brain: null,
  cerveau: null,
};

export function normalizeSegmentName(value: string): string {
  return value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getSegmentCategory(segmentName: string): keyof typeof SEGMENT_CATEGORIES {
  const lower = segmentName.toLowerCase();
  for (const [category, { keywords }] of Object.entries(SEGMENT_CATEGORIES)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category as keyof typeof SEGMENT_CATEGORIES;
    }
  }
  return 'other';
}

export function isSegmentVisibleForMode(segmentName: string, viewMode: string): boolean {
  if (viewMode === 'Full') return true;
  const matcher = MODE_MATCHERS[viewMode];
  if (!matcher) return true;
  return matcher.test(segmentName.toLowerCase());
}

export function buildVisibilityMapForMode(
  segments: string[],
  viewMode: string
): Map<string, boolean> {
  return new Map(
    segments.map((segmentName) => [segmentName, isSegmentVisibleForMode(segmentName, viewMode)])
  );
}

export function normalizeFocusKey(key: string | null | undefined): string | null | undefined {
  if (!key || typeof key !== 'string') return key;
  const normalized = key.toLowerCase().trim();
  return FOCUS_KEY_SYNONYMS[normalized] ?? normalized;
}

function normalizeCardTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
}

export function cardTitleToFocusKey(title: string | null | undefined): string | null {
  if (!title || typeof title !== 'string') return null;
  const key = normalizeCardTitle(title);
  if (key === 'risks' || key === 'risques' || key === 'other' || key === 'autres') return null;
  if (Object.prototype.hasOwnProperty.call(CARD_TITLE_TO_FOCUS, key)) {
    return CARD_TITLE_TO_FOCUS[key];
  }
  if (CATEGORY_MATCHES[key]) return key;
  if (FOCUS_KEY_SYNONYMS[key]) return FOCUS_KEY_SYNONYMS[key];
  return null;
}

export function getSegmentNamesForFocusInList(
  focusKey: string | null | undefined,
  segments: string[]
): string[] {
  if (!focusKey || typeof focusKey !== 'string') return [];
  const key = normalizeFocusKey(focusKey);
  const normalizedKey = normalizeSegmentName(String(key));
  return segments.filter((segmentName) => {
    const normalizedSegment = normalizeSegmentName(segmentName);
    if (normalizedSegment === normalizedKey) return true;
    if (
      key &&
      CATEGORY_MATCHES[String(key)]?.some((keyword) =>
        normalizedSegment.includes(normalizeSegmentName(keyword))
      )
    ) {
      return true;
    }
    return (
      normalizedSegment.includes(normalizedKey) ||
      normalizedKey.includes(normalizedSegment)
    );
  });
}

export function getFocusSegmentSet(
  focusKey: string | null | undefined,
  segments: string[]
): Set<string> {
  return new Set(getSegmentNamesForFocusInList(focusKey, segments));
}

export function isSegmentInFocusInList(
  segmentName: string,
  focusKey: string | null | undefined,
  segments: string[]
): boolean {
  if (!focusKey || !segmentName) return false;
  return getFocusSegmentSet(focusKey, segments).has(segmentName);
}
