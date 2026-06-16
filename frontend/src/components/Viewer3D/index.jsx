import { useState, useEffect, useLayoutEffect, Component, useRef, useCallback } from 'react';
import { Html } from '@react-three/drei';
import { Icon } from '../psUI.jsx';
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
  ViewerLoadFailureOverlay,
} from './ViewerOverlays';
import { ViewerCanvas } from './ViewerCanvas';
import { clearSegmentLoaderCacheForSet } from '../../utils/clearSegmentLoaders';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_ROTATION = { x: -Math.PI / 2, y: 0, z: 0 };
const VIEW_MODES = ['Skeleton', 'Organs', 'Vessels', 'Skin', 'Full'];

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function CanvasLoader({ current, total }) {
  const totalNum = Number(total);
  const totalSafe = Number.isFinite(totalNum) && totalNum > 0 ? totalNum : 1;
  const progress =
    Number.isFinite(totalNum) && totalNum > 0
      ? Math.round((Number(current) / totalSafe) * 100)
      : 0;
  return (
    <Html center>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 192, height: 3, background: 'rgba(255,255,255,0.14)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#00D4FF', width: `${progress}%`, transition: 'width 300ms ease-out' }} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#c4d2e0', background: 'rgba(12,16,20,0.82)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 12px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          Loading {current} / {Number.isFinite(totalNum) ? total : '—'}
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

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Viewer3D] Model error:', error, info?.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      const { onRecover } = this.props;
      return (
        <Html center>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,90,90,0.10)', border: '1px solid rgba(255,90,90,0.25)', fontSize: 13, color: '#ffd9d9', maxWidth: 384, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontWeight: 600 }}>3D Error</p>
            <p style={{ fontSize: 11, color: '#ffb3b3' }}>Unable to load some segments.</p>
            {typeof onRecover === 'function' ? (
              <button
                type="button"
                onClick={() => onRecover()}
                style={{ width: '100%', marginTop: 4, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 500, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Retry
              </button>
            ) : null}
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
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
  const [viewerRecoveryKey, setViewerRecoveryKey] = useState(0);
  const [loadFailureMessage, setLoadFailureMessage] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(() => ({
    current: 0,
    total: getSegmentListForSet(useSceneStore.getState().anatomySegmentSet).length,
  }));

  const currentFocus = useSceneStore((s) => s.currentFocus);
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const setManySegmentVisibility = useSceneStore((s) => s.setManySegmentVisibility);
  const navigationHistory = useSceneStore((s) => s.navigationHistory);
  const historyIndex = useSceneStore((s) => s.historyIndex);
  const addToHistory = useSceneStore((s) => s.addToHistory);
  const historyPushRequest = useSceneStore((s) => s.historyPushRequest);
  const isAnalyzing = useSceneStore((s) => s.isAnalyzing);
  const anatomySegmentSet = useSceneStore((s) => s.anatomySegmentSet);
  const segmentExpected = getSegmentListForSet(anatomySegmentSet).length;
  const isModelReady =
    segmentExpected > 0 &&
    loadingProgress.total === segmentExpected &&
    loadingProgress.current >= segmentExpected;
  const isRestoringRef = useRef(false);
  const prevStateRef = useRef({ focus: currentFocus, visibility: segmentVisibility });
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const isLowEndDevice =
    typeof navigator !== 'undefined' &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency < PERFORMANCE_CONFIG.LOW_END_CPU_CORES;
  useLeakDetector('Viewer3D.container', containerRef);

  const lastAnatomyForLoaderCacheRef = useRef(null);

  const bumpViewerRecovery = useCallback(() => {
    clearSegmentLoaderCacheForSet(useSceneStore.getState().anatomySegmentSet);
    setLoadFailureMessage(null);
    setViewerRecoveryKey((k) => k + 1);
  }, []);

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

  useEffect(() => {
    const list = getSegmentListForSet(anatomySegmentSet);
    setManySegmentVisibility(buildVisibilityMapForMode(list, viewMode));
  }, [setManySegmentVisibility, viewMode, anatomySegmentSet]);

  const skipInitialAnatomyLayoutRef = useRef(true);
  /**
   * On each DICOM/body (= anatomySegmentSet): reset loading bar before Segment onLoad fires,
   * reset zoom slider to match FocusCamera default, and mirror "Reset view" cam state clears
   * so the incoming model loads with a neutral camera (spin off, no pending restores).
   */
  useLayoutEffect(() => {
    if (skipInitialAnatomyLayoutRef.current) {
      skipInitialAnatomyLayoutRef.current = false;
      return;
    }
    const store = useSceneStore.getState();
    const total = getSegmentListForSet(anatomySegmentSet).length;
    store.setCameraAutoSpin(false);
    store.clearCameraFocus();
    store.setPendingCameraRestore(null);
    /* Synchronous React resets before Segment onLoad effects (see block comment above). */
    /* eslint-disable react-hooks/set-state-in-effect -- reset before child Segment useEffects */
    setZoomLevel(38);
    setLoadFailureMessage(null);
    setLoadingProgress({ current: 0, total });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [anatomySegmentSet]);

  useLayoutEffect(() => {
    const prev = lastAnatomyForLoaderCacheRef.current;
    if (prev != null && prev !== anatomySegmentSet) {
      clearSegmentLoaderCacheForSet(prev);
    }
    lastAnatomyForLoaderCacheRef.current = anatomySegmentSet;
  }, [anatomySegmentSet]);

  useEffect(() => {
    if (segmentExpected === 0 || isModelReady) {
      return undefined;
    }
    const ms = PERFORMANCE_CONFIG.MODEL_LOAD_TIMEOUT_MS;
    const id = window.setTimeout(() => {
      setLoadFailureMessage(
        `Loading timed out after ${Math.round(ms / 1000)}s. Check your network and try again.`
      );
    }, ms);
    return () => window.clearTimeout(id);
  }, [anatomySegmentSet, segmentExpected, isModelReady]);

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

  useEffect(
    () => () => {
      disposeRenderer(rendererRef.current);
      const store = useSceneStore.getState();
      store.setModelGroup(null);
      store.setPendingCameraRestore(null);
    },
    []
  );

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      <div className="av-grid" aria-hidden />
      <div className="av-vignette" aria-hidden />
      {!isModelReady && !loadFailureMessage && (
        <ViewerLoadingOverlay current={loadingProgress.current} total={loadingProgress.total} />
      )}
      {loadFailureMessage ? (
        <ViewerLoadFailureOverlay message={loadFailureMessage} onRetry={bumpViewerRecovery} />
      ) : null}

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

      {/* Findings are navigated by clicking the Radiology Report; the av-home
          button below resets the camera and clears the focus. */}
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
        zoomLevel={zoomLevel}
        recoveryKey={viewerRecoveryKey}
        onRecoverModel={bumpViewerRecovery}
      />

      {/* Zoom control — design: .av-zoom */}
      <div className="av-zoom">
        <button type="button" onClick={() => setZoomLevel((v) => Math.min(100, v + 6))} title="Zoom in" aria-label="Zoom in">
          <Icon name="plus" size={15} />
        </button>
        <div className="track" aria-label={`Zoom: ${zoomLevel}%`} role="presentation">
          <div className="knob" style={{ bottom: `calc(${zoomLevel / 100} * (120px - 11px))` }} />
        </div>
        <button type="button" onClick={() => setZoomLevel((v) => Math.max(0, v - 6))} title="Zoom out" aria-label="Zoom out">
          <Icon name="minus" size={15} />
        </button>
      </div>

      <ViewerStaticOverlays />

      {/* DICOM-style readout (design: .av-readout) */}
      <div className="av-readout" aria-hidden>
        <div>CT · Volume Rendered</div>
        <div className="dim">Layer: {viewMode.toLowerCase()} · 512 × 512 × 318</div>
      </div>

      <button type="button" className="av-home" onClick={handleReset} title="Reset the 3D view to the default angle and zoom" aria-label="Reset the 3D view">
        <Icon name="focus-centered" size={15} />
        Reset view
      </button>
      </div>
    </div>
  );
}
