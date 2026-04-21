import { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { colors, radii, shadows, blur } from './design-tokens';
import { SkeletonPanel } from './components/SkeletonPanel.jsx';
import DicomSelector from './components/DicomSelector.jsx';
import { useSceneStore } from './store.js';

// Lazy-load heavy chunks (Three.js + R3F + viewer, Chatbot) for better LCP and TTI
const Viewer3D = lazy(() => import('./components/Viewer3D.jsx'));
const Chatbot = lazy(() => import('./components/Chatbot.jsx'));

function LockedViewerPlaceholder() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-[22rem]">
        <div
          className="mx-auto mb-4 size-14 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] grid place-items-center text-text-secondary"
          aria-hidden
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 1 1 8 0v3" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text">3D viewer locked</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Select a DICOM study from the panel in the top-right corner to load the viewer.
        </p>
      </div>
    </div>
  );
}

function ViewerFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 bg-panel" aria-hidden="true">
      <SkeletonPanel lines={4} className="w-[min(84%,34rem)]" />
    </div>
  );
}

function ChatbotFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 bg-panel" aria-hidden="true">
      <SkeletonPanel lines={3} className="w-[min(84%,24rem)]" />
    </div>
  );
}

function App() {
  const [mobilePanel, setMobilePanel] = useState('viewer');
  const selectedDicom = useSceneStore((s) => s.selectedDicom);
  const viewerUnlocked = Boolean(selectedDicom);

  const motionProps = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.36, ease: 'easeOut' },
  };

  return (
    <div
      className="h-dvh overflow-hidden bg-background text-text"
      style={{
        '--bg-deep': colors.background.deep,
        '--bg-slate': colors.background.slate,
        '--bg-canvas': colors.background.viewerCanvas,
        '--glass': colors.glass.panel,
        '--glass-strong': colors.glass.panelStrong,
        '--glass-border': colors.glass.border,
        '--glass-border-strong': colors.glass.borderStrong,
        '--text-primary': colors.text.primary,
        '--text-secondary': colors.text.secondary,
        '--status-success': colors.status.success,
        '--status-warning': colors.status.warning,
        '--status-critical': colors.status.critical,
        '--radius-panel': radii.panel,
        '--radius-card': radii.card,
        '--radius-btn': radii.button,
        '--shadow-panel': shadows.panel,
        '--shadow-card': shadows.card,
        '--shadow-glow': shadows.glowBlue,
        '--accent-blue': colors.accent.primaryFrom,
        '--accent-blue-2': colors.accent.primaryTo,
        '--accent-cyan': colors.accent.secondary,
        backdropFilter: blur.panel,
      }}
    >
      <header className="glass-panel mx-3 mt-3 px-4 py-3 md:px-5 md:py-3.5">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="size-8 rounded-xl border border-[var(--brand-primary)]/40 flex items-center justify-center text-[var(--brand-primary)]"
              aria-hidden
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h5l2-6 4 12 2-6h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl tracking-tight">
                <span className="font-semibold text-text">Percisio</span>{' '}
                <span className="font-medium text-[var(--brand-primary)]">Sense</span>
              </h1>
              <p className="text-[11px] text-[var(--text-muted)]">AI-Powered 3D Clinical Imaging Platform</p> {/* BRAND: #62C5EF */}
            </div>
          </div>

          <div className="hidden md:flex flex-1 justify-center min-w-0">
            <div className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-text-secondary truncate">
              {selectedDicom
                ? 'CT CAP · IV contrast · 08/09/2025'
                : 'No study loaded'}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              type="button"
              className="size-8 rounded-full border border-[var(--brand-primary)]/30 bg-[var(--brand-primary-light)] overflow-hidden p-0 flex items-center justify-center"
              aria-label="User menu"
            >
              <img
                src="/favicon/apple-touch-icon.png"
                alt="Percisio"
                width={32}
                height={32}
                className="size-full object-cover"
              />
            </button>
          </div>
        </div>
      </header>

      <main className="h-[calc(100dvh-92px)] md:h-[calc(100dvh-104px)] p-3 pt-2 md:p-4 md:pt-3">
        <div className="md:hidden mb-2">
          <div className="grid grid-cols-2 gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] p-1" role="tablist" aria-label="Mobile panel switcher">
            <button
              type="button"
              onClick={() => setMobilePanel('viewer')}
              role="tab"
              aria-selected={mobilePanel === 'viewer'}
              aria-pressed={mobilePanel === 'viewer'}
              className={`rounded-full py-1.5 text-xs ${mobilePanel === 'viewer' ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)]' : 'text-text-secondary'}`}
            >
              Viewer
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel('chat')}
              role="tab"
              aria-selected={mobilePanel === 'chat'}
              aria-pressed={mobilePanel === 'chat'}
              className={`rounded-full py-1.5 text-xs ${mobilePanel === 'chat' ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)]' : 'text-text-secondary'}`}
            >
              Assistant
            </button>
          </div>
        </div>
        <div className="h-full flex flex-col md:flex-row gap-3 md:gap-4">
          <motion.section
            {...motionProps}
            transition={{ ...motionProps.transition, delay: 0.06 }}
            className={`glass-panel relative min-h-0 overflow-hidden flex-col md:basis-[65%] md:max-w-[65%] ${
              mobilePanel === 'viewer' ? 'flex' : 'hidden md:flex'
            }`}
            aria-label="3D clinical viewer"
          >
            <div className="flex-1 min-h-0 relative">
              {viewerUnlocked ? (
                <Suspense fallback={<ViewerFallback />}>
                  <Viewer3D />
                </Suspense>
              ) : (
                <LockedViewerPlaceholder />
              )}
            </div>
          </motion.section>

          <div className="hidden md:block w-px bg-[var(--brand-primary)]/35 shadow-[0_0_12px_rgba(98,197,239,0.45)]" />

          <motion.section
            {...motionProps}
            transition={{ ...motionProps.transition, delay: 0.12 }}
            className={`min-h-0 flex-col md:basis-[35%] md:max-w-[35%] gap-2 md:gap-2.5 ${
              mobilePanel === 'chat' ? 'flex' : 'hidden md:flex'
            }`}
            aria-label="Clinical AI assistant"
          >
            <DicomSelector />
            <div className="glass-panel min-h-0 flex-1 overflow-hidden flex flex-col">
              <Suspense fallback={<ChatbotFallback />}>
                <Chatbot />
              </Suspense>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}

export default App;

