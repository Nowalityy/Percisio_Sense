import { useState, useEffect, lazy, Suspense } from 'react';
import { SkeletonPanel } from './components/SkeletonPanel.jsx';
import RadiologyReport from './components/RadiologyReport.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import { Icon, BrandMark } from './components/psUI.jsx';
import { NotificationsMenu, UserMenu } from './components/TopBarMenus.jsx';
import ShareDialog from './components/ShareDialog.jsx';
import AssistantModal from './components/AssistantModal.jsx';
import AssistantTrigger from './components/AssistantTrigger.jsx';
import { useSceneStore } from './store.js';
import { ASSISTANT_TRIGGER_PLACEMENTS } from './config/assistant.js';
import {
  fetchReportContent,
  getDicomStudyById,
  getScanReportOptionById,
} from './config/dicomStudies.js';
import { parseCaseMeta } from './utils/caseMeta.js';
import { exportReportPdf, captureViewerImages } from './utils/exportReportPdf.js';

/** Shape the store's findings/risks cards into the export PDF's structure. */
function shapeReportFromCards(cards) {
  const all = Array.isArray(cards) ? cards : [];
  const findings = all
    .filter((c) => c?.id !== 'card-risks')
    .map((c) => ({
      title: c.title || 'Finding',
      lines: String(c.content || '')
        .split('\n')
        .map((l) => l.replace(/^[-•\s]+/, '').trim())
        .filter(Boolean),
    }));
  const riskCard = all.find((c) => c?.id === 'card-risks');
  const risks = [];
  if (riskCard) {
    for (const m of String(riskCard.content || '').matchAll(
      /\[(low|medium|high)\]\s*(?:clinical finding:?\s*)?([^[\n]+)/gi
    )) {
      const text = m[2].replace(/[\s;,-]+$/, '').trim();
      if (text.length > 2) risks.push({ severity: m[1].toLowerCase(), text });
    }
  }
  return { findings, risks };
}

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
  const analyzedReport = useSceneStore((s) => s.analyzedReport);
  const [shareOpen, setShareOpen] = useState(false);

  const handlePrint = () => window.print();
  const handleExport = () => {
    const st = useSceneStore.getState();
    const { findings, risks } = shapeReportFromCards(st.lastCards);
    Promise.resolve(
      exportReportPdf({
      meta: {
        caseLabel: meta.caseLabel,
        age: meta.age,
        sexShort: meta.sexShort,
        study: meta.exam,
        referrer: study?.referrer,
        acquired: study?.acquired,
        dose: study?.dose,
      },
      reportBy: 'Percisio AI · Radiology',
      impression: st.lastImpression || '',
      findings,
      risks,
        recommendations: Array.isArray(st.lastRecommendations) ? st.lastRecommendations : [],
        viewerImages: captureViewerImages(),
      })
    ).catch((err) => {
      console.error('PDF export failed', err);
    });
  };

  const shareMeta = {
    caseLabel: meta.caseLabel,
    age: meta.age,
    sexShort: meta.sexShort,
    study: meta.exam,
    referrer: study?.referrer,
    acquired: study?.acquired,
    dose: study?.dose,
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

      <div className="cs-fields">
        <StripField label="Study" value={meta.exam} />
        <StripField label="Referrer" value={study?.referrer} />
        <StripField label="Acquired" value={study?.acquired ? `${study.acquired}${study.dose ? ` · ${study.dose}` : ''}` : ''} mono />
      </div>

      <div className="cs-actions">
        <button className="ps-btn ps-ghost sm" onClick={handleExport} disabled={!analyzedReport} title="Export a PDF report (3D view + findings)">
          <Icon name="download" size={14} /> Export
        </button>
        <button className="ps-btn ps-secondary sm" onClick={() => setShareOpen(true)} disabled={!analyzedReport} title="Share the report (email / WhatsApp), with optional anonymization">
          <Icon name="share-2" size={14} /> Share
        </button>
        <button className="ps-btn ps-primary sm" onClick={handlePrint} title="Print report">
          <Icon name="printer" size={14} /> Print report
        </button>
      </div>

      {shareOpen && (
        <ShareDialog meta={shareMeta} reportBy="Percisio AI · Radiology" onClose={() => setShareOpen(false)} />
      )}
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

const MOBILE_PANES_THREE = [
  { id: 'viewer', label: 'Viewer' },
  { id: 'report', label: 'Report' },
  { id: 'assistant', label: 'Assistant' },
];
const MOBILE_PANES_TWO = [
  { id: 'report', label: 'Report' },
  { id: 'viewer', label: 'Hologram' },
];

/** Small segmented control used for the workspace-layout and trigger-placement switchers. */
function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div className="ps-seg" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`ps-seg-btn ${value === opt.id ? 'on' : ''}`}
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          title={opt.hint || opt.label}
        >
          {opt.icon && <Icon name={opt.icon} size={14} />}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

const LAYOUT_OPTIONS = [
  { id: 'three', label: '3-col', icon: 'layout-columns', hint: 'Viewer · Report · Assistant' },
  { id: 'two', label: '2-col', icon: 'layout-sidebar-right', hint: 'Report + Hologram (assistant in a modal)' },
];

function App() {
  const [mobilePane, setMobilePane] = useState('report');
  const selectedDicom = useSceneStore((s) => s.selectedDicom);
  const workspaceLayout = useSceneStore((s) => s.workspaceLayout);
  const setWorkspaceLayout = useSceneStore((s) => s.setWorkspaceLayout);
  const triggerPlacement = useSceneStore((s) => s.assistantTriggerPlacement);
  const setTriggerPlacement = useSceneStore((s) => s.setAssistantTriggerPlacement);
  const assistantModalOpen = useSceneStore((s) => s.assistantModalOpen);
  const toggleAssistantModal = useSceneStore((s) => s.toggleAssistantModal);
  const viewerUnlocked = Boolean(selectedDicom);
  const study = getDicomStudyById(selectedDicom);
  const meta = parseCaseMeta(study);
  const reportBy = 'Percisio AI · Radiology';
  useDefaultReportLoader();

  const twoCol = workspaceLayout === 'two';
  const mobilePanes = twoCol ? MOBILE_PANES_TWO : MOBILE_PANES_THREE;

  // Derived so switching layouts can't strand the selection on a pane the new
  // layout doesn't have (2-col has no assistant pane) without a setState effect.
  const activePane = mobilePanes.some((p) => p.id === mobilePane) ? mobilePane : mobilePanes[0].id;

  const paneCls = (id) => `clinic-pane ${activePane === id ? 'active' : ''}`;

  // Placement of the assistant trigger. The product ships ONE committed
  // placement — the floating action button — so the launcher is unambiguous and
  // never competes with the layout toggle. The four candidate placements from
  // PER-77 remain comparable for design review via the `?triggerReview=1` flag,
  // which reveals the placement switcher and honours the persisted selection.
  const reviewMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('triggerReview');
  const effectivePlacement = reviewMode ? triggerPlacement : 'fab';
  const showTrigger = (place) => twoCol && effectivePlacement === place;

  const reportRight = (
    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span className="wl-mono">{reportBy}</span>
      {showTrigger('report-bar') && (
        <AssistantTrigger variant="bar" active={assistantModalOpen} onClick={toggleAssistantModal} />
      )}
    </span>
  );

  return (
    <div className={`ps ps-light ps-app ${twoCol ? 'layout-two-col' : 'layout-three-col'}`}>
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
          <Segmented
            options={LAYOUT_OPTIONS}
            value={workspaceLayout}
            onChange={setWorkspaceLayout}
            ariaLabel="Workspace layout"
          />
          {showTrigger('header') && (
            <AssistantTrigger variant="bar" active={assistantModalOpen} onClick={toggleAssistantModal} />
          )}
          <NotificationsMenu />
          <UserMenu initials="PS" />
        </div>
      </header>

      {/* ===== WORKSPACE BODY — vertical patient rail (laptop+) beside the main area ===== */}
      <div className="clinic-body">
      {/* PATIENT STRIP — vertical rail on wide screens, horizontal band on mobile */}
      <PatientStrip study={study} meta={meta} />

      <div className="clinic-main">
      {/* ===== TRIGGER-PLACEMENT REVIEW SWITCHER — design review only (?triggerReview=1) ===== */}
      {twoCol && reviewMode && (
        <div className="asst-place-bar">
          <span className="asst-place-label">Assistant trigger · review</span>
          <Segmented
            options={ASSISTANT_TRIGGER_PLACEMENTS}
            value={triggerPlacement}
            onChange={setTriggerPlacement}
            ariaLabel="Assistant trigger placement"
          />
        </div>
      )}

      {/* ============ MOBILE SWITCHER ============ */}
      <div className="clinic-mobile-tabs">
        {mobilePanes.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`clinic-mtab ${activePane === p.id ? 'on' : ''}`}
            onClick={() => setMobilePane(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ============ WORKSPACE ============ */}
      <div className={`clinic-grid ${twoCol ? 'is-two-col' : ''}`}>
        {/* radiology report — leftmost in 2-col, centre column in 3-col */}
        <div
          data-tour="report"
          className={`${paneCls('report')} ps-card col`}
          style={{ minHeight: 0, overflow: 'hidden', order: twoCol ? 1 : 2 }}
          aria-label="Radiology report"
        >
          <CardHd icon="report-medical" title="Radiology Report" right={reportRight} />
          <div className="ps-divider" />
          <div className="scroll-y grow" style={{ minHeight: 0 }}>
            <RadiologyReport />
          </div>
        </div>

        {/* viewer / hologram */}
        <div
          data-tour="viewer"
          className={`${paneCls('viewer')} ps-card av ps-viewport`}
          style={{ padding: 0, overflow: 'hidden', position: 'relative', order: twoCol ? 2 : 1 }}
          aria-label="3D clinical viewer"
        >
          {viewerUnlocked ? (
            <Suspense fallback={<PaneFallback lines={4} />}>
              <Viewer3D />
            </Suspense>
          ) : (
            <LockedViewerPlaceholder />
          )}
          {showTrigger('hologram-bar') && (
            <div className="asst-holo-trigger">
              <AssistantTrigger variant="bar" active={assistantModalOpen} onClick={toggleAssistantModal} />
            </div>
          )}
        </div>

        {/* clinical assistant — fixed column only in the 3-col layout */}
        {!twoCol && (
          <div data-tour="assistant" className={`${paneCls('assistant')} ps-card col`} style={{ minHeight: 0, overflow: 'hidden', order: 3 }} aria-label="Clinical AI assistant">
            <Suspense fallback={<PaneFallback lines={3} />}>
              <Chatbot />
            </Suspense>
          </div>
        )}
      </div>
      </div>{/* /clinic-main */}
      </div>{/* /clinic-body */}

      {/* Floating assistant modal + FAB trigger (2-col layout) */}
      {twoCol && (
        <>
          {showTrigger('fab') && !assistantModalOpen && (
            <AssistantTrigger variant="fab" active={assistantModalOpen} onClick={toggleAssistantModal} />
          )}
          <AssistantModal />
        </>
      )}

      <OnboardingTour />
    </div>
  );
}

export default App;
