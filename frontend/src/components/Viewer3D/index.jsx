import { useState, useEffect, useLayoutEffect, Component, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useSceneStore } from '../../store';
import { createHistoryState, canNavigateBack, canNavigateForward } from '../../utils/historyManager';
import { getSegmentListForSet } from '../../segmentList';
import { PERFORMANCE_CONFIG } from '../../performance.config';
import { disposeRenderer } from '../../hooks/useDispose';
import { useLeakDetector } from '../../hooks/useLeakDetector';
import { buildVisibilityMapForMode } from '../../viewer-core/segmentRules';
import { ViewerToolbar } from './ViewerToolbar';
import { ViewerHistoryControls } from './ViewerHistoryControls';
import {
  ViewerLoadingOverlay,
  ViewerAnalyzingOverlay,
  ViewerStaticOverlays,
} from './ViewerOverlays';
import { ViewerCanvas } from './ViewerCanvas';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_ROTATION = { x: -Math.PI / 2, y: 0, z: 0 };
const VIEW_MODES = ['Skeleton', 'Organs', 'Vessels', 'Full'];

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function CanvasLoader({ current, total }) {
  const totalSafe = Math.max(1, Number(total) || 1);
  const progress = Math.round((Number(current) / totalSafe) * 100);
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-[var(--brand-primary)] transition-all duration-300 ease-out" // BRAND: #62C5EF
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-200 glass-btn px-3 py-1 rounded-full">
          Loading {current} / {total}
        </div>
      </div>
    </Html>
  );
}

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Viewer3D] Model error:', this.state.error);
      }
      return (
        <Html center>
          <div className="px-4 py-3 rounded-lg bg-red-400/10 border border-red-300/25 text-sm text-red-100 max-w-md shadow-sm">
            <p className="font-semibold">3D Error</p>
            <p className="text-xs text-red-200">Unable to load some segments.</p>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

function CompactButton({ onClick, icon, title, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass-btn p-2.5 rounded-xl active:scale-95 flex items-center justify-center text-xs ${
        active ? 'text-[var(--text-on-brand)] bg-[var(--brand-primary)] border-[var(--border-brand)] shadow-[var(--shadow-md)]' : 'text-slate-700'
      }`}
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
}

function CameraZoomController({ zoomLevel }) {
  const { camera } = useThree();

  useEffect(() => {
    const nextZoom = 0.8 + (Number(zoomLevel) / 100) * 0.65;
    // r3f exposes mutable THREE objects by design — direct mutation is expected.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = nextZoom;
    camera.updateProjectionMatrix();
  }, [camera, zoomLevel]);

  return null;
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function Viewer3D() {
  /**
   * The model is rendered at a fixed rotation (DEFAULT_ROTATION). Camera
   * framing is handled in FocusCamera.
   */
  const [zoomLevel, setZoomLevel] = useState(38);
  const [viewMode, setViewMode] = useState('Full');
  const [loadingProgress, setLoadingProgress] = useState(() => ({
    current: 0,
    total: Math.max(1, getSegmentListForSet(useSceneStore.getState().anatomySegmentSet).length),
  }));
  const isModelReady =
    loadingProgress.total > 0 && loadingProgress.current >= loadingProgress.total;

  const currentFocus = useSceneStore((s) => s.currentFocus);
  const citedOrgans = useSceneStore((s) => s.citedOrgans);
  const citedOrganIndex = useSceneStore((s) => s.citedOrganIndex);
  const goToNextCitedOrgan = useSceneStore((s) => s.goToNextCitedOrgan);
  const goToPrevCitedOrgan = useSceneStore((s) => s.goToPrevCitedOrgan);
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const setManySegmentVisibility = useSceneStore((s) => s.setManySegmentVisibility);
  const navigationHistory = useSceneStore((s) => s.navigationHistory);
  const historyIndex = useSceneStore((s) => s.historyIndex);
  const addToHistory = useSceneStore((s) => s.addToHistory);
  const historyPushRequest = useSceneStore((s) => s.historyPushRequest);
  const isAnalyzing = useSceneStore((s) => s.isAnalyzing);
  const anatomySegmentSet = useSceneStore((s) => s.anatomySegmentSet);
  const isRestoringRef = useRef(false);
  const prevStateRef = useRef({ focus: currentFocus, visibility: segmentVisibility });
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const lastZoomUpdateRef = useRef(0);
  const isLowEndDevice =
    typeof navigator !== 'undefined' &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency < PERFORMANCE_CONFIG.LOW_END_CPU_CORES;
  useLeakDetector('Viewer3D.container', containerRef);

  const handleProgress = useCallback((current, total) => {
    setLoadingProgress({ current, total });
  }, []);

  const handleReset = useCallback(() => {
    const store = useSceneStore.getState();
    store.setCameraAutoSpin(false);
    store.clearCameraFocus();
    const defaultCameraState = store.getDefaultCameraState?.();
    if (defaultCameraState) {
      store.setPendingCameraRestore(defaultCameraState);
    }
    setZoomLevel(38);
  }, []);

  const handleZoomChange = useCallback((nextValue) => {
    const now = performance.now();
    // PERF: Throttle zoom updates to 60 FPS to avoid control spam.
    if (now - lastZoomUpdateRef.current < PERFORMANCE_CONFIG.FRAME_THROTTLE_MS) {
      return;
    }
    lastZoomUpdateRef.current = now;
    setZoomLevel(nextValue);
  }, []);

  useEffect(() => {
    const list = getSegmentListForSet(anatomySegmentSet);
    setManySegmentVisibility(buildVisibilityMapForMode(list, viewMode));
  }, [setManySegmentVisibility, viewMode, anatomySegmentSet]);

  const skipAnatomyLoadResetRef = useRef(true);
  /**
   * Reset the loading bar in `useLayoutEffect` (not `useEffect` + `setTimeout(0)`).
   * If we zero progress after child `useEffect` runs, Segment `onLoad` has
   * already fired and will not re-run — progress can stay 0 / total forever
   * after many fast switches. Layout effect runs before child passive effects
   * (onLoad) and before paint, so the bar resets before segment hooks run.
   */
  useLayoutEffect(() => {
    if (skipAnatomyLoadResetRef.current) {
      skipAnatomyLoadResetRef.current = false;
      return;
    }
    const total = Math.max(1, getSegmentListForSet(anatomySegmentSet).length);
    // set-state-in-effect: intentional synchronous reset before Segment useEffects; see block comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset must run before child useEffect (onLoad)
    setLoadingProgress({ current: 0, total });
  }, [anatomySegmentSet]);

  /** Keep zoom slider aligned with FocusCamera when the DICOM / segment set changes. */
  const skipAnatomyZoomResetRef = useRef(true);
  useLayoutEffect(() => {
    if (skipAnatomyZoomResetRef.current) {
      skipAnatomyZoomResetRef.current = false;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with FocusCamera default when dataset changes
    setZoomLevel(38);
  }, [anatomySegmentSet]);

  const handleHistoryNavigation = useCallback((direction) => {
    const store = useSceneStore.getState();
    const { historyIndex: idx, navigationHistory: history } = store;
    const targetIndex = direction === 'back' ? idx - 1 : idx + 1;
    const state = history[targetIndex];
    if (state == null) return;

    isRestoringRef.current = true;
    store.navigateHistory(direction);

    if (state.focus != null) {
      store.setFocus(state.focus);
    } else {
      store.clearCameraFocus();
    }

    if (state.segmentVisibility && typeof state.segmentVisibility.forEach === 'function') {
      useSceneStore.getState().setManySegmentVisibility(state.segmentVisibility);
    }

    if (state.cameraState != null) {
      useSceneStore.getState().setPendingCameraRestore(state.cameraState);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
      const isRedo = (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey));
      if (isUndo && canNavigateBack(historyIndex)) {
        e.preventDefault();
        handleHistoryNavigation('back');
      } else if (isRedo && canNavigateForward(historyIndex, navigationHistory.length)) {
        e.preventDefault();
        handleHistoryNavigation('forward');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, navigationHistory.length, handleHistoryNavigation]);

  const saveToHistory = useCallback(() => {
    const cameraState = useSceneStore.getState().getCameraState?.() ?? null;
    const historyState = createHistoryState(currentFocus, segmentVisibility, cameraState);
    addToHistory(historyState);
  }, [currentFocus, segmentVisibility, addToHistory]);

  useEffect(() => {
    if (historyIndex >= 0) return;
    const frameId = requestAnimationFrame(() => {
      const store = useSceneStore.getState();
      if (store.historyIndex >= 0) return;
      const cameraState = store.getCameraState?.() ?? null;
      const historyState = createHistoryState(
        store.currentFocus,
        store.segmentVisibility,
        cameraState
      );
      store.addToHistory(historyState);
    });
    return () => cancelAnimationFrame(frameId);
  }, [historyIndex]);

  useEffect(() => {
    if (historyIndex < 0) return;
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      prevStateRef.current = { focus: currentFocus, visibility: segmentVisibility };
      return;
    }
    const prev = prevStateRef.current;
    const focusChanged = prev.focus !== currentFocus;
    const visibilityChanged = prev.visibility !== segmentVisibility;
    if (!focusChanged && !visibilityChanged) return;
    prevStateRef.current = { focus: currentFocus, visibility: segmentVisibility };
    saveToHistory();
  }, [currentFocus, segmentVisibility, historyIndex, saveToHistory]);

  useEffect(() => {
    if (historyIndex < 0 || !historyPushRequest) return;
    saveToHistory();
  }, [historyPushRequest, historyIndex, saveToHistory]);

  useEffect(() => {
    return () => {
      // PERF: Release renderer resources on viewer unmount.
      disposeRenderer(rendererRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative group">
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 52%, rgba(226, 232, 240, 0.42) 100%)',
        }}
        aria-hidden
      />
      <div className="absolute inset-0 pointer-events-none rounded-[16px] border border-[var(--border-brand)]/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-[var(--shadow-md)]" /> {/* BRAND: #62C5EF */}
      {!isModelReady && (
        <ViewerLoadingOverlay current={loadingProgress.current} total={loadingProgress.total} />
      )}

      <ViewerAnalyzingOverlay isAnalyzing={isAnalyzing} />
      <div
        className="w-full h-full transition-[filter] duration-300"
        style={{ filter: isAnalyzing ? 'saturate(0.97)' : 'saturate(1)' }}
      >
      <ViewerToolbar viewMode={viewMode} viewModes={VIEW_MODES} onModeChange={setViewMode} />
      <ViewerHistoryControls
        historyIndex={historyIndex}
        navigationHistoryLength={navigationHistory.length}
        onNavigate={handleHistoryNavigation}
      />

      {(currentFocus || citedOrgans.length > 1) && (
        <div className="absolute top-16 left-4 z-30 flex items-center gap-1.5">
          {citedOrgans.length > 1 && (
            <div className="flex items-center gap-1 glass-btn rounded-full px-2 py-1.5 text-[10px] font-medium text-slate-100">
              <button
                type="button"
                onClick={goToPrevCitedOrgan}
                className="p-1 rounded-full hover:bg-white/15 transition-colors"
                title="Previous organ"
                aria-label="Previous organ"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <span className="min-w-[2.5rem] text-center tabular-nums">
                {citedOrganIndex + 1}/{citedOrgans.length}
              </span>
              <button
                type="button"
                onClick={goToNextCitedOrgan}
                className="p-1 rounded-full hover:bg-white/15 transition-colors"
                title="Next organ"
                aria-label="Next organ"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
          {currentFocus && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-full bg-red-500/85 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider border border-red-300/40 active:scale-95 shadow-md"
              aria-label="Reset camera view and clear organ focus"
              title="Reset view"
            >
              ✕ Reset view
            </button>
          )}
        </div>
      )}

      <ViewerCanvas
        isLowEndDevice={isLowEndDevice}
        maxDpr={PERFORMANCE_CONFIG.MAX_DPR}
        rendererRef={rendererRef}
        loadingProgress={loadingProgress}
        modelErrorBoundary={ModelErrorBoundary}
        canvasLoader={CanvasLoader}
        rotation={DEFAULT_ROTATION}
        isAutoSpinning={false}
        onProgress={handleProgress}
        anatomySegmentSet={anatomySegmentSet}
      >
        <CameraZoomController zoomLevel={zoomLevel} />
      </ViewerCanvas>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 glass-card px-2 py-3 flex flex-col items-center gap-2">
        <button type="button" className="text-text-secondary text-xs" onClick={() => setZoomLevel((v) => Math.min(100, v + 6))}>+</button>
        <input
          aria-label="Zoom level"
          type="range"
          min="0"
          max="100"
          value={zoomLevel}
          onChange={(event) => handleZoomChange(Number(event.target.value))}
          className="[writing-mode:bt-lr] appearance-none h-28 w-1 rounded-full bg-white/20 accent-[var(--brand-primary)]" // BRAND: #62C5EF
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        />
        <button type="button" className="text-text-secondary text-xs" onClick={() => setZoomLevel((v) => Math.max(0, v - 6))}>−</button>
      </div>

      <ViewerStaticOverlays />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-1 p-1.5 glass-card rounded-full overflow-hidden">
          <CompactButton onClick={handleReset} title="Reset" icon="⌂" />
        </div>
      </div>
      </div>
    </div>
  );
}
