/**
 * Realistic medical color palette - Enhanced with vibrant colors
 */
export const MEDICAL_COLORS = {
  // Main organs
  'heart': '#dc2626', // Bright red for heart
  'liver': '#a16207', // Brown for liver
  'lung': '#ec4899', // Pink for lungs
  'stomach': '#f97316', // Orange for stomach
  'pancreas': '#eab308', // Bright yellow for pancreas
  'spleen': '#991b1b', // Dark red for spleen
  'thyroid': '#f472b6', // Pink for thyroid
  'kidney': '#059669', // Green for kidneys
  'adrenal': '#fbbf24', // Yellow for adrenal glands
  
  // Circulatory system
  'aorta': '#dc2626', // Red for aorta
  'artery': '#ef4444', // Light red for arteries
  'vein': '#3b82f6', // Blue for veins
  'inferior-vena-cava': '#2563eb', // Dark blue for inferior vena cava
  'superior-vena-cava': '#3b82f6', // Light blue for superior vena cava
  'brachiocephalic-trunk': '#f59e0b', // Orange for brachiocephalic trunk
  'subclavian-artery': '#ef4444', // Red for subclavian arteries
  'common-carotid-artery': '#dc2626', // Red for carotid arteries
  'brachiocephalic-vein': '#60a5fa', // Light blue for brachiocephalic veins
  'pulmonary': '#38bdf8', // Sky blue for pulmonary system
  'pulmonary-venous-system': '#38bdf8', // Sky blue for pulmonary venous system
  'portal-vein-and-splenic-vein': '#2563eb', // Blue for portal and splenic veins
  'atrial-appendage': '#dc2626', // Red for atrial appendage
  
  // Respiratory system
  'trachea': '#cbd5e1', // Light gray for trachea
  'esophagus': '#fda4af', // Pale pink for esophagus
  
  // Skeletal system
  'clavicle': '#ffffff', // White for clavicles
  'scapula': '#f8fafc', // Off-white for scapulae
  'humerus': '#f1f5f9', // Off-white for humerus
  'sternum': '#ffffff', // White for sternum
  'spinal-cord': '#e2e8f0', // Light gray for spinal cord
  
  // Muscles
  'muscle': '#991b1b', // Red-brown for muscles
  'deep-back-muscle': '#7f1d1d', // Dark red for deep back muscles
  
  // Envelope/Skin
  'segment_1': '#f9dfc5', // Beige/skin for envelope
};

export const getSegmentColor = (name) => {
  const lowerName = name.toLowerCase();
  
  // Correspondances spécifiques pour les segments avec noms complets (priorité haute)
  const specificMatches = {
    'inferior-lobe-of-left-lung': MEDICAL_COLORS['lung'],
    'inferior-lobe-of-right-lung': MEDICAL_COLORS['lung'],
    'superior-lobe-of-left-lung': MEDICAL_COLORS['lung'],
    'superior-lobe-of-right-lung': MEDICAL_COLORS['lung'],
    'middle-lobe-of-right-lung': MEDICAL_COLORS['lung'],
    'left-clavicle': MEDICAL_COLORS['clavicle'],
    'right-clavicle': MEDICAL_COLORS['clavicle'],
    'left-scapula': MEDICAL_COLORS['scapula'],
    'right-scapula': MEDICAL_COLORS['scapula'],
    'left-humerus': MEDICAL_COLORS['humerus'],
    'right-humerus': MEDICAL_COLORS['humerus'],
    'left-deep-back-muscle': MEDICAL_COLORS['deep-back-muscle'],
    'right-deep-back-muscle': MEDICAL_COLORS['deep-back-muscle'],
    'left-subclavian-artery': MEDICAL_COLORS['subclavian-artery'],
    'right-subclavian-artery': MEDICAL_COLORS['subclavian-artery'],
    'left-common-carotid-artery': MEDICAL_COLORS['common-carotid-artery'],
    'right-common-carotid-artery': MEDICAL_COLORS['common-carotid-artery'],
    'left-brachiocephalic-vein': MEDICAL_COLORS['brachiocephalic-vein'],
    'right-brachiocephalic-vein': MEDICAL_COLORS['brachiocephalic-vein'],
    'left-atrial-appendage': MEDICAL_COLORS['atrial-appendage'],
    'right-adrenal-gland': MEDICAL_COLORS['adrenal'],
  };
  
  // Check specific matches first
  if (specificMatches[lowerName]) {
    return specificMatches[lowerName];
  }
  
  // Then search by partial match (priority order)
  const priorityOrder = [
    'heart', 'liver', 'lung', 'stomach', 'pancreas', 'spleen', 'thyroid',
    'aorta', 'artery', 'vein', 'vena-cava', 'brachiocephalic', 'subclavian',
    'carotid', 'pulmonary', 'portal-vein', 'atrial-appendage',
    'trachea', 'esophagus',
    'clavicle', 'scapula', 'humerus', 'sternum', 'spinal-cord',
    'muscle', 'deep-back-muscle',
    'segment_1'
  ];
  
  for (const key of priorityOrder) {
    if (lowerName.includes(key) && MEDICAL_COLORS[key]) {
      return MEDICAL_COLORS[key];
    }
  }
  
  // General search in all colors
  for (const [key, color] of Object.entries(MEDICAL_COLORS)) {
    if (lowerName.includes(key)) return color;
  }
  
  return '#94a3b8'; // Default slate
};

export const SEGMENTS = [
  'aorta',
  'brachiocephalic-trunk',
  'esophagus',
  'heart',
  'inferior-lobe-of-left-lung',
  'inferior-lobe-of-right-lung',
  'inferior-vena-cava',
  'left-atrial-appendage',
  'left-brachiocephalic-vein',
  'left-clavicle',
  'left-common-carotid-artery',
  'left-deep-back-muscle',
  'left-humerus',
  'left-scapula',
  'left-subclavian-artery',
  'liver',
  'middle-lobe-of-right-lung',
  'pancreas',
  'portal-vein-and-splenic-vein',
  'pulmonary-venous-system',
  'right-adrenal-gland',
  'right-brachiocephalic-vein',
  'right-clavicle',
  'right-common-carotid-artery',
  'right-deep-back-muscle',
  'right-humerus',
  'right-scapula',
  'right-subclavian-artery',
  'segment_1',
  'spinal-cord',
  'spleen',
  'sternum',
  'stomach',
  'superior-lobe-of-left-lung',
  'superior-lobe-of-right-lung',
  'superior-vena-cava',
  'thyroid',
  'trachea'
];
