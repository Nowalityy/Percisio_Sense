import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useSceneStore } from '../store.js';
import { getDefaultAnatomySetId } from '../segmentList.js';
import {
  DICOM_STUDIES,
  SCAN_REPORT_OPTIONS,
  fetchReportContent,
  getDicomStudyById,
  getScanReportOptionById,
} from '../config/dicomStudies.js';

const PLACEHOLDER_VALUE = '';

export default function DicomSelector() {
  const selectedDicom = useSceneStore((s) => s.selectedDicom);
  const selectedReportId = useSceneStore((s) => s.selectedReportId);
  const analyzedReport = useSceneStore((s) => s.analyzedReport);
  const setSelectedDicom = useSceneStore((s) => s.setSelectedDicom);
  const setSelectedReportId = useSceneStore((s) => s.setSelectedReportId);
  const setAnalyzedReport = useSceneStore((s) => s.setAnalyzedReport);
  const setAnatomySegmentSet = useSceneStore((s) => s.setAnatomySegmentSet);
  const reportFetchAbortRef = useRef(null);

  useEffect(
    () => () => {
      reportFetchAbortRef.current?.abort();
    },
    []
  );

  const selectedDicomLabel = useMemo(
    () => DICOM_STUDIES.find((d) => d.id === selectedDicom)?.label ?? '',
    [selectedDicom]
  );

  const selectedReportLabel = useMemo(
    () => SCAN_REPORT_OPTIONS.find((r) => r.id === selectedReportId)?.label ?? '',
    [selectedReportId]
  );

  const loadReportText = useCallback(
    async (reportId, signal) => {
      if (!reportId) {
        setAnalyzedReport(null);
        return;
      }
      try {
        const text = await fetchReportContent(reportId, signal);
        setAnalyzedReport(text.trim().length > 0 ? text : null);
      } catch (err) {
        if (err && typeof err === 'object' && err.name === 'AbortError') {
          return;
        }
        const opt = getScanReportOptionById(reportId);
        const hint = opt ? `public/reports/${opt.fileName}` : reportId;
        setAnalyzedReport(`The report could not be loaded (expected file: ${hint}).`);
      }
    },
    [setAnalyzedReport]
  );

  /** Load default (or restored) report text on mount and after session reset. */
  useEffect(() => {
    if (!selectedReportId || analyzedReport) return undefined;
    const ac = new AbortController();
    reportFetchAbortRef.current = ac;
    void loadReportText(selectedReportId, ac.signal);
    return () => ac.abort();
  }, [selectedReportId, analyzedReport, loadReportText]);

  const handleReportChange = useCallback(
    async (e) => {
      const value = e.target.value;
      reportFetchAbortRef.current?.abort();

      if (!value) {
        setSelectedReportId(null);
        setAnalyzedReport(null);
        return;
      }

      setSelectedReportId(value);
      const ac = new AbortController();
      reportFetchAbortRef.current = ac;
      await loadReportText(value, ac.signal);
    },
    [setSelectedReportId, setAnalyzedReport, loadReportText]
  );

  const handleDicomChange = useCallback(
    (e) => {
      const value = e.target.value;
      reportFetchAbortRef.current?.abort();

      if (!value) {
        setSelectedDicom(null);
        setSelectedReportId(null);
        setAnatomySegmentSet(getDefaultAnatomySetId());
        setAnalyzedReport(null);
        return;
      }
      const study = getDicomStudyById(value);
      if (!study) {
        setSelectedDicom(null);
        setSelectedReportId(null);
        setAnatomySegmentSet(getDefaultAnatomySetId());
        setAnalyzedReport(null);
        return;
      }

      setSelectedDicom(value);
      if (study.segmentSetId) {
        setAnatomySegmentSet(study.segmentSetId);
      }
      setSelectedReportId(null);
      setAnalyzedReport(null);
    },
    [
      setSelectedDicom,
      setSelectedReportId,
      setAnatomySegmentSet,
      setAnalyzedReport,
    ]
  );

  return (
    <div
      className="glass-panel shrink-0 p-2.5 shadow-[var(--shadow-sm)]"
      role="region"
      aria-label="DICOM study and report selectors"
    >
      {/* DICOM → 3D */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="size-4 rounded-md border border-[var(--border-brand)] bg-[var(--brand-primary-light)] grid place-items-center text-[var(--brand-primary-dark)] shrink-0"
          aria-hidden
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="4" width="18" height="14" rx="2" />
            <path d="M3 10h18M8 4v4" />
          </svg>
        </span>
        <label
          htmlFor="dicom-study-select"
          className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary truncate min-w-0"
        >
          Select a DICOM study
        </label>
      </div>

      <div className="relative z-20 mb-3">
        <select
          id="dicom-study-select"
          value={selectedDicom ?? PLACEHOLDER_VALUE}
          onChange={handleDicomChange}
          className="glass-input w-full min-w-0 max-w-full appearance-none pr-7 pl-2.5 py-1.5 text-[11px] cursor-pointer"
          aria-label="DICOM study (3D model)"
          title={selectedDicomLabel || 'Select a DICOM study'}
        >
          <option value={PLACEHOLDER_VALUE} disabled>
            — Choose a study —
          </option>
          {DICOM_STUDIES.map((study) => (
            <option key={study.id} value={study.id}>
              {study.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[var(--text-muted)]"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Report → chat context */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="size-4 rounded-md border border-[var(--border-brand)] bg-[var(--brand-primary-light)] grid place-items-center text-[var(--brand-primary-dark)] shrink-0"
          aria-hidden
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
        </span>
        <label
          htmlFor="scan-report-select"
          className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary truncate min-w-0"
        >
          Select a report
        </label>
      </div>

      <div className="relative z-10">
        <select
          id="scan-report-select"
          value={selectedReportId ?? PLACEHOLDER_VALUE}
          onChange={handleReportChange}
          className="glass-input w-full min-w-0 max-w-full appearance-none pr-7 pl-2.5 py-1.5 text-[11px] cursor-pointer"
          aria-label="Scan report text for chat"
          title={selectedReportLabel || 'Select a scan report'}
        >
          <option value={PLACEHOLDER_VALUE} disabled>
            — Choose a report —
          </option>
          {SCAN_REPORT_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[var(--text-muted)]"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
