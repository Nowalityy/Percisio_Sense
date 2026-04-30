/**
 * DICOM study list for the app shell. Each entry maps to a folder under
 * `public/models/segments/<segmentSetId>/` (see `segmentSets.json`).
 *
 * Text reports in the chat dropdown use patient-centered labels (see {@link SCAN_REPORT_OPTIONS}).
 */

export const DICOM_STUDIES = [
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
 * Reports in `public/reports/`. Dropdown labels: patient + exam for `.txt`; for PDFs, clinical
 * descriptors only (no file-format suffix). Edit `label` when patient metadata is known.
 */
export const SCAN_REPORT_OPTIONS = [
  {
    id: 'report-1',
    label: 'Laura SCHMIDT — Thoracic CT',
    fileName: 'alan-dicom.txt',
    format: 'text',
  },
  {
    id: 'report-2',
    label: 'Camille DURAND — Thoraco-abdomino-pelvic CT',
    fileName: 'sandra5-dicom.txt',
    format: 'text',
  },
  {
    id: 'report-3',
    label: 'Karim BENSAID — Abdomino-pelvic CT — uro, low-dose',
    fileName: 'paul2-dicom.txt',
    format: 'text',
  },
  {
    id: 'report-4',
    label: 'Julien MARTIN — Abdomino-pelvic CT',
    fileName: 'fred-dicom.txt',
    format: 'text',
  },
  {
    id: 'report-5',
    label: 'Abdomino-pelvic imaging — case 5',
    fileName: 'rapport_5_AP.pdf',
    format: 'pdf',
  },
  {
    id: 'report-6',
    label: 'TAP / whole-body imaging — case 6',
    fileName: 'rapport_6_TAP.pdf',
    format: 'pdf',
  },
  {
    id: 'report-7',
    label: 'TAP / whole-body imaging — case 7',
    fileName: 'rapport_7_TAP.pdf',
    format: 'pdf',
  },
  {
    id: 'report-8',
    label: 'Abdomino-pelvic imaging — case 8',
    fileName: 'rapport_8_AP.pdf',
    format: 'pdf',
  },
];

/**
 * @param {string} fileName - basename under `public/reports/`
 */
export function reportAssetUrl(fileName) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}/reports/${encodeURIComponent(fileName)}`;
}

/** @param {string} reportId - e.g. `report-1` */
export function getScanReportOptionById(reportId) {
  return SCAN_REPORT_OPTIONS.find((r) => r.id === reportId) ?? null;
}

async function extractTextFromPdfBuffer(arrayBuffer, signal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const [{ getDocument, GlobalWorkerOptions }, workerMod] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = workerMod.default;
  }
  const loadingTask = getDocument({ data: arrayBuffer, useSystemFonts: true });
  let pdf;
  try {
    pdf = await loadingTask.promise;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const line = textContent.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .join(' ');
      parts.push(line);
    }
    return parts.join('\n\n').trim();
  } finally {
    if (pdf) {
      await pdf.destroy().catch(() => {});
    }
  }
}

/**
 * Load report text for chat context: `.txt` as-is, PDF via pdf.js text extraction.
 * @param {string} reportId - one of `SCAN_REPORT_OPTIONS[].id`
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function fetchReportContent(reportId, signal) {
  const opt = getScanReportOptionById(reportId);
  if (!opt) {
    throw new Error(`Unknown report id: ${reportId}`);
  }
  const res = await fetch(reportAssetUrl(opt.fileName), { signal });
  if (!res.ok) {
    throw new Error(`Report not found (${res.status}): ${opt.fileName}`);
  }
  if (opt.format === 'text') {
    return res.text();
  }
  const buf = await res.arrayBuffer();
  return extractTextFromPdfBuffer(buf, signal);
}

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
