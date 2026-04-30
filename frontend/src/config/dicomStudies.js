/**
 * DICOM study list for the app shell. Each entry maps to a folder under
 * `public/models/segments/<segmentSetId>/` (see `segmentSets.json`).
 *
 * Reports for the chat are listed separately as {@link SCAN_REPORT_OPTIONS} (`Report 1`…`Report 8`).
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
 * Numbered reports in `public/reports/` — labels shown in the report dropdown.
 * - Reports 1–4: `.txt` exports
 * - Reports 5–8: PDFs (text is extracted client-side for the chat context)
 */
export const SCAN_REPORT_OPTIONS = [
  { id: 'report-1', label: 'Report 1', fileName: 'alan-dicom.txt', format: 'text' },
  { id: 'report-2', label: 'Report 2', fileName: 'sandra5-dicom.txt', format: 'text' },
  { id: 'report-3', label: 'Report 3', fileName: 'paul2-dicom.txt', format: 'text' },
  { id: 'report-4', label: 'Report 4', fileName: 'fred-dicom.txt', format: 'text' },
  { id: 'report-5', label: 'Report 5', fileName: 'rapport_5_AP.pdf', format: 'pdf' },
  { id: 'report-6', label: 'Report 6', fileName: 'rapport_6_TAP.pdf', format: 'pdf' },
  { id: 'report-7', label: 'Report 7', fileName: 'rapport_7_TAP.pdf', format: 'pdf' },
  { id: 'report-8', label: 'Report 8', fileName: 'rapport_8_AP.pdf', format: 'pdf' },
];

/**
 * When a DICOM study is selected, load this report id by default (see `SCAN_REPORT_OPTIONS`).
 */
export const DICOM_STUDY_TO_DEFAULT_REPORT_ID = Object.freeze({
  'scan-tap-2025-09-08': 'report-1',
  'alan-dicom': 'report-1',
  'sandra5-dicom': 'report-2',
  'paul2-dicom': 'report-3',
  'fred-dicom': 'report-4',
});

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
