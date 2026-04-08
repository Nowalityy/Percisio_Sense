import { useState, Suspense, useEffect, Component, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useSceneStore } from '../../store';
import { SceneLights } from './SceneLights';
import { ScannerModel } from './ScannerModel';
import { FocusCamera } from './FocusCamera';
import { SegmentFilterPanel } from './SegmentFilterPanel';
import { createHistoryState, canNavigateBack, canNavigateForward } from '../../utils/historyManager';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ROTATION_STEP = Math.PI / 8;
const DEFAULT_ROTATION = { x: -Math.PI / 2, y: 0, z: 0 };
const INITIAL_LOADING_TOTAL = 38;

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function CanvasLoader({ current, total }) {
  const totalSafe = Math.max(1, Number(total) || 1);
  const progress = Math.round((Number(current) / totalSafe) * 100);
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 glass-btn px-3 py-1 rounded-full">
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
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900 max-w-md shadow-sm">
            <p className="font-semibold">3D Error</p>
            <p className="text-xs text-red-700">Unable to load some segments.</p>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

function CompactButton({ onClick, icon, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-btn p-2.5 rounded-xl text-slate-600 active:scale-95 flex items-center justify-center transition-all duration-200 hover:bg-slate-100 hover:shadow-md focus:ring-2 focus:ring-accent/20 focus:ring-offset-1"
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function Viewer3D() {
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({
    current: 0,
    total: INITIAL_LOADING_TOTAL,
  });

  const currentFocus = useSceneStore((s) => s.currentFocus);
  const citedOrgans = useSceneStore((s) => s.citedOrgans);
  const citedOrganIndex = useSceneStore((s) => s.citedOrganIndex);
  const goToNextCitedOrgan = useSceneStore((s) => s.goToNextCitedOrgan);
  const goToPrevCitedOrgan = useSceneStore((s) => s.goToPrevCitedOrgan);
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const navigationHistory = useSceneStore((s) => s.navigationHistory);
  const historyIndex = useSceneStore((s) => s.historyIndex);
  const addToHistory = useSceneStore((s) => s.addToHistory);
  const navigateHistory = useSceneStore((s) => s.navigateHistory);
  const historyPushRequest = useSceneStore((s) => s.historyPushRequest);
  const isAnalyzing = useSceneStore((s) => s.isAnalyzing);

  const isRestoringRef = useRef(false);
  const prevStateRef = useRef({ focus: currentFocus, visibility: segmentVisibility });

  const handleProgress = useCallback((current, total) => {
    setLoadingProgress({ current, total });
  }, []);

  const handleRotate = useCallback((direction) => {
    setIsAutoSpinning(false);
    setRotation((prev) => {
      switch (direction) {
        case 'up':
          return { ...prev, x: prev.x - ROTATION_STEP };
        case 'down':
          return { ...prev, x: prev.x + ROTATION_STEP };
        case 'left':
          return { ...prev, y: prev.y - ROTATION_STEP };
        case 'right':
          return { ...prev, y: prev.y + ROTATION_STEP };
        case 'tilt-left':
          return { ...prev, z: prev.z - ROTATION_STEP };
        case 'tilt-right':
          return { ...prev, z: prev.z + ROTATION_STEP };
        case 'reset':
          return { ...DEFAULT_ROTATION };
        default:
          return prev;
      }
    });
  }, []);

  const handleFlip = useCallback(() => {
    setIsAutoSpinning(false);
    setRotation((prev) => ({ ...prev, x: prev.x + Math.PI }));
  }, []);

  const toggleAutoSpin = useCallback(() => {
    setIsAutoSpinning((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    const store = useSceneStore.getState();
    store.clearCameraFocus();
    setRotation({ ...DEFAULT_ROTATION });
    const defaultCameraState = store.getDefaultCameraState?.();
    if (defaultCameraState) {
      store.setPendingCameraRestore(defaultCameraState);
    }
  }, []);

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
      state.segmentVisibility.forEach((visible, segmentName) => {
        useSceneStore.getState().setSegmentVisibility(segmentName, visible);
      });
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

  return (
    <div className="w-full h-full bg-white overflow-hidden relative group">
      {/* Vignette très subtile sur les bords du viewer */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 55%, rgba(15, 23, 42, 0.04) 100%)',
        }}
        aria-hidden
      />
      {/* Quand l’IA analyse : légère désaturation + overlay avec spinner et texte */}
      {isAnalyzing && (
        <div
          className="absolute inset-0 pointer-events-none z-20 flex flex-col items-end justify-start pt-3 pr-3 gap-2"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-accent rounded-full animate-spin" aria-hidden />
            <span>Analyzing anatomical structures…</span>
          </div>
        </div>
      )}
      <div
        className="w-full h-full transition-[filter] duration-300"
        style={{ filter: isAnalyzing ? 'saturate(0.97)' : 'saturate(1)' }}
      >
      <SegmentFilterPanel />

      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleHistoryNavigation('back')}
          disabled={!canNavigateBack(historyIndex)}
          className="glass-btn px-3 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium text-slate-700"
          title="Previous (Ctrl+Z)"
          aria-label="Previous view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleHistoryNavigation('forward')}
          disabled={!canNavigateForward(historyIndex, navigationHistory.length)}
          className="glass-btn px-3 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium text-slate-700"
          title="Next (Ctrl+Shift+Z)"
          aria-label="Next view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {(currentFocus || citedOrgans.length > 1) && (
        <div className="absolute top-14 left-4 z-30 flex items-center gap-1.5">
          {citedOrgans.length > 1 && (
            <div className="flex items-center gap-1 glass-btn rounded-full px-2 py-1.5 text-[10px] font-medium text-slate-700">
              <button
                type="button"
                onClick={goToPrevCitedOrgan}
                className="p-1 rounded-full hover:bg-slate-200 transition-colors"
                title="Organe précédent"
                aria-label="Organe précédent"
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
                className="p-1 rounded-full hover:bg-slate-200 transition-colors"
                title="Organe suivant"
                aria-label="Organe suivant"
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
              className="px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider border border-red-400 active:scale-95 shadow-md"
              aria-label="Reset camera view and clear organ focus"
              title="Reset view"
            >
              ✕ Reset view
            </button>
          )}
        </div>
      )}

      <Canvas
        shadows={false}
        dpr={[1, 2]}
        camera={{ position: [0, 0.1, 3.19], fov: 50, near: 0.01, far: 2000 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          logarithmicDepthBuffer: false,
          preserveDrawingBuffer: false,
        }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color('#ffffff');
        }}
      >
        <SceneLights />
        <group position={[0, 0.11, 0]}>
          <ModelErrorBoundary>
            <Suspense
              fallback={
                <CanvasLoader current={loadingProgress.current} total={loadingProgress.total} />
              }
            >
              <ScannerModel
                rotation={rotation}
                isAutoSpinning={isAutoSpinning}
                onProgress={handleProgress}
              />
            </Suspense>
          </ModelErrorBoundary>
        </group>
        <FocusCamera />
      </Canvas>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-1 p-1.5 glass-btn rounded-2xl overflow-hidden">
          <CompactButton onClick={handleReset} title="Reset" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>} />
          <div className="w-px h-4 bg-slate-400/20 mx-0.5" />
          <CompactButton onClick={handleFlip} title="Flip" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 18v-2c0-4.4 3.6-8 8-8h10"/><path d="m7 22-4-4 4-4"/><path d="M21 6v2c0 4.4-3.6 8-8 8H3"/></svg>} />
          <div className="w-px h-4 bg-slate-400/20 mx-0.5" />
          <div className="flex gap-0.5">
            <CompactButton onClick={() => handleRotate('up')} title="Up" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>} />
            <CompactButton onClick={() => handleRotate('down')} title="Down" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>} />
            <CompactButton onClick={() => handleRotate('left')} title="Left" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>} />
            <CompactButton onClick={() => handleRotate('right')} title="Right" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>} />
          </div>
          <div className="w-px h-4 bg-slate-400/20 mx-0.5" />
          <div className="flex gap-0.5">
            <CompactButton onClick={() => handleRotate('tilt-left')} title="Tilt Left" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12a10 10 0 0 0-10-10"/><path d="m7 15-5-3 5-3"/><path d="M2 12h5"/></svg>} />
            <CompactButton onClick={() => handleRotate('tilt-right')} title="Tilt Right" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12a10 10 0 0 1 10-10"/><path d="m17 9 5 3-5 3"/><path d="M22 12h-5"/></svg>} />
          </div>
          <div className="w-px h-4 bg-slate-400/20 mx-0.5" />
          <button
            type="button"
            onClick={toggleAutoSpin}
            className={`p-2.5 rounded-xl transition-all active:scale-90 ${isAutoSpinning ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 animate-pulse' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Auto-rotation"
            aria-label={isAutoSpinning ? 'Stop auto-rotation' : 'Start auto-rotation'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
