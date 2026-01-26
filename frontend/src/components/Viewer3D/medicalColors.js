/**
 * Realistic medical color palette - Enhanced with vibrant colors
 */
export const MEDICAL_COLORS = {
  // Organes principaux
  'heart': '#dc2626', // Rouge vif pour le cœur
  'liver': '#a16207', // Marron/brun pour le foie
  'lung': '#ec4899', // Rose pour les poumons
  'stomach': '#f97316', // Orange pour l'estomac
  'pancreas': '#eab308', // Jaune vif pour le pancréas
  'spleen': '#991b1b', // Rouge foncé pour la rate
  'thyroid': '#f472b6', // Rose pour la thyroïde
  'kidney': '#059669', // Vert pour les reins
  'adrenal': '#fbbf24', // Jaune pour les glandes surrénales
  
  // Système circulatoire
  'aorta': '#dc2626', // Rouge pour l'aorte
  'artery': '#ef4444', // Rouge clair pour les artères
  'vein': '#3b82f6', // Bleu pour les veines
  'inferior-vena-cava': '#2563eb', // Bleu foncé pour la veine cave inférieure
  'superior-vena-cava': '#3b82f6', // Bleu clair pour la veine cave supérieure
  'brachiocephalic-trunk': '#f59e0b', // Orange pour le tronc brachiocéphalique
  'subclavian-artery': '#ef4444', // Rouge pour les artères sous-clavières
  'common-carotid-artery': '#dc2626', // Rouge pour les artères carotides
  'brachiocephalic-vein': '#60a5fa', // Bleu clair pour les veines brachiocéphaliques
  'pulmonary': '#38bdf8', // Bleu ciel pour le système pulmonaire
  'pulmonary-venous-system': '#38bdf8', // Bleu ciel pour le système veineux pulmonaire
  'portal-vein-and-splenic-vein': '#2563eb', // Bleu pour les veines porte et splénique
  'atrial-appendage': '#dc2626', // Rouge pour l'appendice auriculaire
  
  // Système respiratoire
  'trachea': '#cbd5e1', // Gris clair pour la trachée
  'esophagus': '#fda4af', // Rose pâle pour l'œsophage
  
  // Système squelettique
  'clavicle': '#ffffff', // Blanc pour les clavicules
  'scapula': '#f8fafc', // Blanc cassé pour les omoplates
  'humerus': '#f1f5f9', // Blanc cassé pour les humérus
  'sternum': '#ffffff', // Blanc pour le sternum
  'spinal-cord': '#e2e8f0', // Gris clair pour la moelle épinière
  
  // Muscles
  'muscle': '#991b1b', // Rouge brun pour les muscles
  'deep-back-muscle': '#7f1d1d', // Rouge foncé pour les muscles profonds du dos
  
  // Enveloppe/Peau
  'segment_1': '#f9dfc5', // Beige/peau pour l'enveloppe
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
  
  // Vérifier d'abord les correspondances spécifiques
  if (specificMatches[lowerName]) {
    return specificMatches[lowerName];
  }
  
  // Ensuite chercher par correspondance partielle (ordre de priorité)
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
  
  // Recherche générale dans toutes les couleurs
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
