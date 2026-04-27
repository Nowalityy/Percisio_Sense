import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useSceneStore } from '../store.js';
import { getDefaultAnatomySetId } from '../segmentList.js';
import { DICOM_STUDIES, fetchScanReportText, getDicomStudyById } from '../config/dicomStudies.js';

const PLACEHOLDER_VALUE = '';

export default function DicomSelector() {
  const selectedDicom = useSceneStore((s) => s.selectedDicom);
  const setSelectedDicom = useSceneStore((s) => s.setSelectedDicom);
  const setAnalyzedReport = useSceneStore((s) => s.setAnalyzedReport);
  const setAnatomySegmentSet = useSceneStore((s) => s.setAnatomySegmentSet);
  const reportFetchAbortRef = useRef(null);

  useEffect(
    () => () => {
      reportFetchAbortRef.current?.abort();
    },
    []
  );

  const selectedLabel = useMemo(
    () => DICOM_STUDIES.find((d) => d.id === selectedDicom)?.label ?? '',
    [selectedDicom]
  );

  const handleChange = useCallback(
    async (e) => {
      const value = e.target.value;
      reportFetchAbortRef.current?.abort();

      if (!value) {
        setSelectedDicom(null);
        setAnatomySegmentSet(getDefaultAnatomySetId());
        return;
      }
      const study = getDicomStudyById(value);
      if (!study) {
        setSelectedDicom(null);
        setAnatomySegmentSet(getDefaultAnatomySetId());
        return;
      }

      setSelectedDicom(value);
      if (study.segmentSetId) {
        setAnatomySegmentSet(study.segmentSetId);
      }

      const ac = new AbortController();
      reportFetchAbortRef.current = ac;
      try {
        const text = await fetchScanReportText(value, ac.signal);
        setAnalyzedReport(text.trim().length > 0 ? text : null);
      } catch (err) {
        if (err && typeof err === 'object' && err.name === 'AbortError') {
          return;
        }
        setAnalyzedReport(
          `Le rapport n’a pas pu être chargé (fichier attendu : public/reports/${value}.txt).`
        );
      }
    },
    [setSelectedDicom, setAnatomySegmentSet, setAnalyzedReport]
  );

  return (
    <div
      className="glass-panel shrink-0 p-2.5 shadow-[var(--shadow-sm)]"
      role="region"
      aria-label="DICOM study selector"
    >
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
          className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary truncate"
        >
          Select a DICOM study
        </label>
      </div>

      {/*
        Do not use `truncate` (overflow: hidden) on <select> — it breaks the native
        options menu in several Chromium/WebKit builds (click opens list then it
        won’t select / menu doesn’t appear correctly).
      */}
      <div className="relative z-20">
        <select
          id="dicom-study-select"
          value={selectedDicom ?? PLACEHOLDER_VALUE}
          onChange={handleChange}
          className="glass-input w-full min-w-0 max-w-full appearance-none pr-7 pl-2.5 py-1.5 text-[11px] cursor-pointer"
          aria-label="DICOM study"
          title={selectedLabel || 'Select a DICOM study'}
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

      <div className="flex items-center gap-1.5 my-2" aria-hidden>
        <div className="flex-1 h-px bg-[var(--border-default)]" />
        <span className="text-[9px] uppercase tracking-wider text-text-secondary">— or —</span>
        <div className="flex-1 h-px bg-[var(--border-default)]" />
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Coming soon"
        className="glass-btn w-full py-1.5 text-[11px] font-medium rounded-lg inline-flex items-center justify-center gap-1.5"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M7 16l5-5 5 5M12 11V3" />
          <path d="M4 17v2h16v-2" />
        </svg>
        Upload your data
      </button>
    </div>
  );
}
