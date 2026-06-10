import { useCallback, useMemo, useRef, useEffect } from 'react';
import { Icon } from './psUI.jsx';
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

  const shortStudy = selectedDicomLabel ? selectedDicomLabel.split('—')[0].trim() : '';
  const shortReport = selectedReportLabel ? selectedReportLabel.split('—')[0].trim() : '';

  return (
    <div className="row gap8" role="region" aria-label="DICOM study and report selectors" style={{ marginRight: 4 }}>
      {/* DICOM → 3D */}
      <label className="ps-select" style={{ width: 'auto', padding: '7px 11px', position: 'relative' }} title={selectedDicomLabel || 'Select a DICOM study'}>
        <Icon name="database" size={14} color="var(--accent)" />
        <span className="mono" style={{ fontSize: 12 }}>{shortStudy || 'Study'}</span>
        <Icon name="chevron-down" size={14} className="chev" />
        <select
          id="dicom-study-select"
          value={selectedDicom ?? PLACEHOLDER_VALUE}
          onChange={handleDicomChange}
          aria-label="DICOM study (3D model)"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
        >
          <option value={PLACEHOLDER_VALUE} disabled>— Study —</option>
          {DICOM_STUDIES.map((study) => (
            <option key={study.id} value={study.id}>{study.label}</option>
          ))}
        </select>
      </label>

      {/* Report → chat + report context */}
      <label className="ps-select" style={{ width: 'auto', padding: '7px 11px', position: 'relative' }} title={selectedReportLabel || 'Select a scan report'}>
        <Icon name="file-text" size={14} color="var(--accent)" />
        <span style={{ fontSize: 12 }}>{shortReport || 'Report'}</span>
        <Icon name="chevron-down" size={14} className="chev" />
        <select
          id="scan-report-select"
          value={selectedReportId ?? PLACEHOLDER_VALUE}
          onChange={handleReportChange}
          aria-label="Scan report"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
        >
          <option value={PLACEHOLDER_VALUE} disabled>— Report —</option>
          {SCAN_REPORT_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
