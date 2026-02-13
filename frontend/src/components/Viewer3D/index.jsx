import { useState, Suspense, useEffect, Component, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Html, PerformanceMonitor, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import { useSceneStore } from '../../store';
import { SceneLights } from './SceneLights';
import { ScannerModel } from './ScannerModel';
import { FocusCamera } from './FocusCamera';
import { SegmentFilterPanel } from './SegmentFilterPanel';
import { createHistoryState, canNavigateBack, canNavigateForward } from '../../utils/historyManager';

/**
 * Loading indicator with granular progress
 */
function CanvasLoader({ current, total }) {
  const progress = Math.round((current / total) * 100) || 0;
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
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
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

export default function Viewer3D() {
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 38 });
  
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const navigationHistory = useSceneStore((s) => s.navigationHistory);
  const historyIndex = useSceneStore((s) => s.historyIndex);
  const addToHistory = useSceneStore((s) => s.addToHistory);
  const navigateHistory = useSceneStore((s) => s.navigateHistory);
  const historyPushRequest = useSceneStore((s) => s.historyPushRequest);

  const isRestoringRef = useRef(false);
  const prevStateRef = useRef({ focus: currentFocus, visibility: segmentVisibility });

  const handleProgress = useCallback((curr, tot) => {
    setLoadingProgress({ current: curr, total: tot });
  }, []);

  const handleRotate = (dir) => {
    const step = Math.PI / 8;
    if (isAutoSpinning) setIsAutoSpinning(false);
    setRotation(prev => {
      switch (dir) {
        case 'up': return { ...prev, x: prev.x - step };
        case 'down': return { ...prev, x: prev.x + step };
        case 'left': return { ...prev, y: prev.y - step };
        case 'right': return { ...prev, y: prev.y + step };
        case 'tilt-left': return { ...prev, z: prev.z - step };
        case 'tilt-right': return { ...prev, z: prev.z + step };
        case 'reset': return { x: 0, y: 0, z: 0 };
        default: return prev;
      }
    });
  };

  const handleFlip = () => {
    if (isAutoSpinning) setIsAutoSpinning(false);
    setRotation(prev => ({ ...prev, x: prev.x + Math.PI }));
  };

  const toggleAutoSpin = () => setIsAutoSpinning(!isAutoSpinning);

  /** Clear organ focus only — camera stays, no animation. */
  const handleCancelFocus = useCallback(() => {
    useSceneStore.getState().clearFocus();
  }, []);

  /** Reset: clear focus + reset model rotation. Pas d'animation caméra. */
  const handleReset = () => {
    useSceneStore.getState().clearFocus();
    setRotation({ x: 0, y: 0, z: 0 });
  };

  const handleHistoryNavigation = useCallback((direction) => {
    const store = useSceneStore.getState();
    const idx = store.historyIndex;
    const history = store.navigationHistory;
    const targetIndex = direction === 'back' ? idx - 1 : idx + 1;
    const state = history[targetIndex];
    if (state == null) return;
    isRestoringRef.current = true;
    store.navigateHistory(direction);
    if (state.focus != null) {
      store.setFocus(state.focus);
    } else {
      store.clearFocus();
    }
    if (state.segmentVisibility && typeof state.segmentVisibility.forEach === 'function') {
      state.segmentVisibility.forEach((visible, name) => {
        useSceneStore.getState().setSegmentVisibility(name, visible);
      });
    }
    if (state.cameraState != null) {
      useSceneStore.getState().setPendingCameraRestore(state.cameraState);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canNavigateBack(historyIndex)) {
          handleHistoryNavigation('back');
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canNavigateForward(historyIndex, navigationHistory.length)) {
          handleHistoryNavigation('forward');
        }
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

  // Initial save when no history yet (deferred so FocusCamera has set getCameraState)
  useEffect(() => {
    if (historyIndex >= 0) return;
    const id = requestAnimationFrame(() => {
      if (useSceneStore.getState().historyIndex >= 0) return;
      const cameraState = useSceneStore.getState().getCameraState?.() ?? null;
      const state = useSceneStore.getState();
      const historyState = createHistoryState(
        state.currentFocus,
        state.segmentVisibility,
        cameraState
      );
      useSceneStore.getState().addToHistory(historyState);
    });
    return () => cancelAnimationFrame(id);
  }, [historyIndex]);

  // Save a new history entry when user changes focus or segment visibility (not when restoring)
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

  // Save when user finishes moving the camera (orbit/pan/zoom)
  useEffect(() => {
    if (historyIndex < 0 || !historyPushRequest) return;
    saveToHistory();
  }, [historyPushRequest, historyIndex, saveToHistory]);

  return (
    <div className="w-full h-full bg-slate-100 overflow-hidden relative group">
      <SegmentFilterPanel />
      {/* History Navigation */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleHistoryNavigation('back')}
          disabled={!canNavigateBack(historyIndex)}
          className="glass-btn px-3 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium text-slate-700"
          title="Previous (Ctrl+Z)"
          aria-label="Previous view"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {/* Reset view / clear organ focus — left side so it's clearly separate from the Filters button */}
      {currentFocus && (
        <button
          type="button"
          onClick={handleCancelFocus}
          className="absolute top-14 left-4 z-30 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider border border-red-400 active:scale-95 shadow-md"
          aria-label="Reset camera view and clear organ focus"
          title="Reset view"
        >
          ✕ Reset view
        </button>
      )}

      <Canvas 
        shadows={false}
        dpr={[1, 2]}
        camera={{ position: [0, 2.8, 12], fov: 50, near: 0.01, far: 2000 }}
        gl={{ 
          antialias: true, 
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
          logarithmicDepthBuffer: false,
          preserveDrawingBuffer: false,
        }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color('#f8fafc');
        }}
      >
        <SceneLights />
        
        <group position={[0, 0, 0]}>
          <ModelErrorBoundary>
            <Suspense fallback={<CanvasLoader current={loadingProgress.current} total={loadingProgress.total} />}>
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
      
      {/* Floating Control Bar */}
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

      {/* Control Hint Overlay */}
      <div className="absolute bottom-4 left-4 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100 hidden md:block">
        <div className="glass-btn px-3 py-2 rounded-xl text-[10px] text-slate-600 uppercase tracking-wider font-semibold space-y-1">
          <p>🖱️ Rotation: Left Click</p>
          <p>🖐️ Pan: Right Click</p>
          <p>🔍 Zoom: Scroll Wheel</p>
        </div>
      </div>
    </div>
  );
}

function CompactButton({ onClick, icon, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-btn p-2.5 rounded-xl text-slate-600 active:scale-95 flex items-center justify-center"
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
}
