/**
 * DICOM study list for the app shell. Each entry maps to a folder under
 * `public/models/segments/<segmentSetId>/` (see `segmentSets.json`).
 *
 * Rapports de scan : un fichier texte par étude dans `public/reports/<id>.txt`
 * (même `id` que ci-dessous). Voir `public/reports/README.md`.
 */

export const DICOM_STUDIES = [
  {
    id: 'scan-tap-2025-09-08',
    label: 'SCAN TAP AVEC IV 08-09-2025 TAP PORTAL (frednonopti — source DICOM)',
    segmentSetId: 'frednonopti',
  },
  {
    id: 'alan-dicom',
    label: 'Alan DICOM (percisio_export)',
    segmentSetId: 'percisio_export',
  },
  {
    id: 'sandra5-dicom',
    label: 'Sandra DICOM (percisio_export_sandra5)',
    segmentSetId: 'percisio_export_sandra5',
  },
  {
    id: 'paul2-dicom',
    label: 'Paul DICOM (percisio_export_paul2)',
    segmentSetId: 'percisio_export_paul2',
  },
  {
    id: 'fred-dicom',
    label: 'Fred DICOM (percisio_export_fred)',
    segmentSetId: 'percisio_export_fred',
  },
];

/**
 * Décalage vertical du groupe 3D (après le lift commun 0.7 dans ViewerCanvas).
 * Valeur négative = corps plus bas dans l’écran. À ajuster par export si le repère
 * OBJ n’est pas au même endroit (ex. Sandra apparait trop haut).
 * @type {Record<string, number>}
 */
export const VIEWER_GROUP_Y_OFFSET_BY_SEGMENT_SET = {
  percisio_export_sandra5: -0.78,
};

/**
 * @param {string | undefined | null} segmentSetId - ex. `percisio_export_sandra5`
 * @returns {number}
 */
export function getViewerGroupYOffset(segmentSetId) {
  if (!segmentSetId) return 0;
  return VIEWER_GROUP_Y_OFFSET_BY_SEGMENT_SET[segmentSetId] ?? 0;
}

/**
 * Même Y que le groupe modèle dans `ViewerCanvas` (lift de base + offset par export).
 * La caméra par défaut doit cibler ce point en monde, pas (0,0,0), sinon le corps
 * semble mal placé dès qu’on change d’offset vertical par jeu de segments, ou au
 * retour sur un DICOM si le premier plan n’a pas le même cadrage.
 */
export const VIEWER_MODEL_BASE_LIFT_Y = 0.7;

export function getModelRootWorldY(segmentSetId) {
  return VIEWER_MODEL_BASE_LIFT_Y + getViewerGroupYOffset(segmentSetId);
}

/** @param {string} id */
export function getDicomStudyById(id) {
  return DICOM_STUDIES.find((d) => d.id === id) ?? null;
}

/**
 * URL du rapport texte pour une étude (`public/reports/<id>.txt`).
 * @param {string} studyId
 */
export function scanReportUrlForStudy(studyId) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}/reports/${encodeURIComponent(studyId)}.txt`;
}

/**
 * Charge le rapport depuis `public/reports/<id>.txt`.
 * @param {string} studyId
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function fetchScanReportText(studyId, signal) {
  const res = await fetch(scanReportUrlForStudy(studyId), { signal });
  if (!res.ok) {
    throw new Error(`Report not found (${res.status}): ${studyId}`);
  }
  return res.text();
}
