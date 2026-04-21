import { useCallback, useMemo } from 'react';
import { useSceneStore } from '../store.js';

const DICOM_STUDIES = [
  {
    id: 'scan-tap-2025-09-08',
    label: 'SCAN TAP AVEC IV 08-09-2025 TAP PORTAL',
  },
];

const PREDEFINED_REPORTS = {
  'scan-tap-2025-09-08': `CHEST-ABDOMEN-PELVIS CT SCAN
Date: 02/12/2026 — Dr Julien MARTIN

Indication:
Diffuse abdominal pain evolving for several weeks, associated with fatigue and moderate weight loss. Family history of tumoral pathologies.

Technique:
Chest-abdomen-pelvis CT acquisition performed without and then with intravenous injection of iodinated contrast agent, at portal phase.

Findings:

Thoracic region:
- Thyroid of normal morphology and density
- No mediastinal or axillary lymphadenopathy
- No pleural or pericardial effusion
- Proximal bronchial tree clear
- No focal suspicious pulmonary lesion

Abdomino-pelvic region:
- Liver of normal size and density
- Two hypodense hepatic lesions: segment VII (8 mm), segment V (6 mm) — non-specific appearance
- Spleen, pancreas and adrenal glands unremarkable
- Kidneys of normal morphology, no suspicious lesion
- No abdominal or pelvic lymphadenopathy
- No intra-abdominal effusion
- Appendix of normal appearance
- Bone structures without suspicious findings
- Benign vertebral hemangiomas at T8 and T11

Conclusion:
- No suspicious chest-abdomen-pelvis abnormality
- Two small uncharacterized hepatic lesions
- Complementary hepatic MRI recommended for characterization`,
};

const PLACEHOLDER_VALUE = '';

export default function DicomSelector() {
  const selectedDicom = useSceneStore((s) => s.selectedDicom);
  const setSelectedDicom = useSceneStore((s) => s.setSelectedDicom);
  const setAnalyzedReport = useSceneStore((s) => s.setAnalyzedReport);

  const selectedLabel = useMemo(
    () => DICOM_STUDIES.find((d) => d.id === selectedDicom)?.label ?? '',
    [selectedDicom]
  );

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (!value) {
        setSelectedDicom(null);
        return;
      }
      const report = PREDEFINED_REPORTS[value];
      setSelectedDicom(value);
      if (typeof report === 'string' && report.trim().length > 0) {
        setAnalyzedReport(report);
      }
    },
    [setSelectedDicom, setAnalyzedReport]
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

      <div className="relative">
        <select
          id="dicom-study-select"
          value={selectedDicom ?? PLACEHOLDER_VALUE}
          onChange={handleChange}
          className="glass-input w-full appearance-none pr-7 pl-2.5 py-1.5 text-[11px] truncate"
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
