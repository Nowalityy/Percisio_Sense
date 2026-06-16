import { useState, useEffect, lazy, Suspense } from 'react';
import { SkeletonPanel } from './components/SkeletonPanel.jsx';
import RadiologyReport from './components/RadiologyReport.jsx';
import { Icon, BrandMark } from './components/psUI.jsx';
import { NotificationsMenu, UserMenu } from './components/TopBarMenus.jsx';
import { useSceneStore } from './store.js';
import {
  fetchReportContent,
  getDicomStudyById,
  getScanReportOptionById,
  reportAssetUrl,
} from './config/dicomStudies.js';
import { parseCaseMeta } from './utils/caseMeta.js';

// Lazy-load heavy chunks (Three.js + R3F + viewer, Chatbot) for better LCP and TTI
const Viewer3D = lazy(() => import('./components/Viewer3D.jsx'));
const Chatbot = lazy(() => import('./components/Chatbot.jsx'));

function LockedViewerPlaceholder() {
  return (
    <div className="av" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }} role="status" aria-live="polite">
      <div style={{ maxWidth: 300 }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center', color: '#cbd5e1' }} aria-hidden>
          <Icon name="lock" size={24} />
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e8edf2' }}>3D viewer locked</h3>
        <p style={{ marginTop: 4, fontSize: 13, color: '#8ea0b4' }}>Select a DICOM study to load the volume.</p>
      </div>
    </div>
  );
}

function PaneFallback({ lines }) {
  return (
    <div className="grow" style={{ display: 'grid', placeItems: 'center', minHeight: 0 }} aria-hidden="true">
      <SkeletonPanel lines={lines} className="w-[min(84%,30rem)]" />
    </div>
  );
}

/** Loads the default case's report text on startup and after a session reset
    (previously lived in the removed report picker). */
function useDefaultReportLoader() {
  const selectedReportId = useSceneStore((s) => s.selectedReportId);
  const analyzedReport = useSceneStore((s) => s.analyzedReport);
  const setAnalyzedReport = useSceneStore((s) => s.setAnalyzedReport);

  useEffect(() => {
    if (!selectedReportId || analyzedReport) return undefined;
    const ac = new AbortController();
    (async () => {
      try {
        const text = await fetchReportContent(selectedReportId, ac.signal);
        setAnalyzedReport(text.trim().length > 0 ? text : null);
      } catch (err) {
        if (err && typeof err === 'object' && err.name === 'AbortError') return;
        const opt = getScanReportOptionById(selectedReportId);
        const hint = opt ? `public/reports/${opt.fileName}` : selectedReportId;
        setAnalyzedReport(`The report could not be loaded (expected file: ${hint}).`);
      }
    })();
    return () => ac.abort();
  }, [selectedReportId, analyzedReport, setAnalyzedReport]);
}

/** One labelled column in the patient header strip. */
function StripField({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="col gap6" style={{ minWidth: 0 }}>
      <span className="over">{label}</span>
      <span className={mono ? 'wl-mono' : undefined} style={mono ? { color: 'var(--text)' } : { fontSize: 13, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function PatientStrip({ study, meta }) {
  const selectedReportId = useSceneStore((s) => s.selectedReportId);
  const analyzedReport = useSceneStore((s) => s.analyzedReport);

  const handlePrint = () => window.print();
  const handleExport = () => {
    const opt = getScanReportOptionById(selectedReportId);
    if (opt) window.open(reportAssetUrl(opt.fileName), '_blank', 'noopener,noreferrer');
  };
  const handleShare = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
    } catch {
      /* clipboard unavailable */
    }
  };

  const demographic = [meta.age ? `${meta.age}Y` : null, meta.sexShort].filter(Boolean).join(' ');

  return (
    <div className="clinic-strip">
      <div className="row gap12">
        <div className="wl-mod" style={{ width: 40, height: 40 }}>
          <Icon name="user" size={20} />
        </div>
        <div className="col">
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>{meta.caseLabel || 'No case selected'}</span>
          <span className="wl-mono">Synthetic{demographic ? ` · ${demographic}` : ''}</span>
        </div>
      </div>

      <div className="ps-top-sep" />

      <StripField label="Study" value={meta.exam} />
      <StripField label="Referrer" value={study?.referrer} />
      <StripField label="Acquired" value={study?.acquired ? `${study.acquired}${study.dose ? ` · ${study.dose}` : ''}` : ''} mono />

      <div className="row gap8" style={{ marginLeft: 'auto' }}>
        <button className="ps-btn ps-ghost sm" onClick={handleExport} disabled={!analyzedReport} title="Open the source report">
          <Icon name="download" size={14} /> Export
        </button>
        <button className="ps-btn ps-secondary sm" onClick={handleShare} title="Copy a link to this case">
          <Icon name="share-2" size={14} /> Share
        </button>
        <button className="ps-btn ps-primary sm" onClick={handlePrint} title="Print report">
          <Icon name="printer" size={14} /> Print report
        </button>
      </div>
    </div>
  );
}

/** Report-medical card header, matching the design's CardHd. */
function CardHd({ icon, title, right }) {
  return (
    <div className="ps-panel-hd">
      {icon && <Icon name={icon} size={16} color="var(--accent)" />}
      <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</span>
      {right}
    </div>
  );
}

const MOBILE_PANES = [
  { id: 'viewer', label: 'Viewer' },
  { id: 'report', label: 'Report' },
  { id: 'assistant', label: 'Assistant' },
];

function App() {
  const [mobilePane, setMobilePane] = useState('report');
  const selectedDicom = useSceneStore((s) => s.selectedDicom);
  const viewerUnlocked = Boolean(selectedDicom);
  const study = getDicomStudyById(selectedDicom);
  const meta = parseCaseMeta(study);
  const reportBy = 'Percisio AI · Radiology';
  useDefaultReportLoader();

  const paneCls = (id) => `clinic-pane ${mobilePane === id ? 'active' : ''}`;

  return (
    <div className="ps ps-light ps-app">
      {/* ============ TOP BAR ============ */}
      <header className="ps-top">
        <div className="ps-brand">
          <div className="ps-logo"><BrandMark /></div>
          <div className="ps-brand-tt">
            <span className="ps-brand-name">Percisio <b>Sense</b></span>
            <span className="ps-brand-sub">AI Clinical Imaging Platform</span>
          </div>
        </div>
        <div className="ps-top-actions">
          <NotificationsMenu />
          <UserMenu initials="PS" />
        </div>
      </header>

      {/* ============ PATIENT STRIP ============ */}
      <PatientStrip study={study} meta={meta} />

      {/* ============ MOBILE SWITCHER ============ */}
      <div className="clinic-mobile-tabs">
        {MOBILE_PANES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`clinic-mtab ${mobilePane === p.id ? 'on' : ''}`}
            onClick={() => setMobilePane(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ============ WORKSPACE ============ */}
      <div className="clinic-grid">
        {/* viewer — full-height left column */}
        <div className={`${paneCls('viewer')} ps-card av ps-viewport`} style={{ padding: 0, overflow: 'hidden', position: 'relative' }} aria-label="3D clinical viewer">
          {viewerUnlocked ? (
            <Suspense fallback={<PaneFallback lines={4} />}>
              <Viewer3D />
            </Suspense>
          ) : (
            <LockedViewerPlaceholder />
          )}
        </div>

        {/* radiology report (centrepiece) */}
        <div className={`${paneCls('report')} ps-card col`} style={{ minHeight: 0, overflow: 'hidden' }} aria-label="Radiology report">
          <CardHd icon="report-medical" title="Radiology Report" right={<span style={{ marginLeft: 'auto' }} className="wl-mono">{reportBy}</span>} />
          <div className="ps-divider" />
          <div className="scroll-y grow" style={{ minHeight: 0 }}>
            <RadiologyReport />
          </div>
        </div>

        {/* clinical assistant */}
        <div className={`${paneCls('assistant')} ps-card col`} style={{ minHeight: 0, overflow: 'hidden' }} aria-label="Clinical AI assistant">
          <Suspense fallback={<PaneFallback lines={3} />}>
            <Chatbot />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default App;
