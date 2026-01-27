import { useState, Suspense, useEffect, Component, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, PerformanceMonitor, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import { useSceneStore } from '../../store';
import { SceneLights } from './SceneLights';
import { ScannerModel } from './ScannerModel';
import { FocusCamera } from './FocusCamera';
import { SegmentFilterPanel } from './SegmentFilterPanel';
import { SegmentInfoPanel } from './SegmentInfoPanel';
import { SegmentClickHandler } from './SegmentClickHandler';
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
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-slate-100">
          Chargement {current} / {total}
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
            <p className="font-semibold">Erreur 3D</p>
            <p className="text-xs text-red-700">Impossible de charger certains segments.</p>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

function InitialCameraAdjustment() {
  const { camera, scene } = useThree();
  useEffect(() => {
    // Calculer le centre réel du modèle
    const calculateAndSetCamera = () => {
      const box = new THREE.Box3();
      let hasObjects = false;
      
      scene.traverse((child) => {
        if (child.isMesh && child.visible) {
          box.expandByObject(child);
          hasObjects = true;
        }
      });
      
      if (hasObjects) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        // Le centre du torse est environ au 1/3 supérieur du modèle
        const torsoCenterY = center.y + size.y * 0.15;
        
        const defaultZ = window.innerWidth < 768 ? 16 : 12;
        camera.position.set(center.x, torsoCenterY + 2, center.z + defaultZ);
        camera.lookAt(center.x, torsoCenterY, center.z);
        camera.updateProjectionMatrix();
        console.log(`[InitialCamera] Set to center: (${center.x.toFixed(2)}, ${torsoCenterY.toFixed(2)}, ${center.z.toFixed(2)})`);
      } else {
        // Fallback si le modèle n'est pas encore chargé
        const defaultZ = window.innerWidth < 768 ? 16 : 12;
        camera.position.set(0, 0.8 + 2, defaultZ);
        camera.lookAt(0, 0.8, 0);
        camera.updateProjectionMatrix();
      }
    };
    
    // Essayer plusieurs fois pour s'assurer que le modèle est chargé
    calculateAndSetCamera();
    const timer = setTimeout(calculateAndSetCamera, 2000);
    const timer2 = setTimeout(calculateAndSetCamera, 5000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [camera, scene]);
  return null;
}

export default function Viewer3D() {
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 38 });
  const [selectedSegment, setSelectedSegment] = useState(null);
  
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const navigationHistory = useSceneStore((s) => s.navigationHistory);
  const historyIndex = useSceneStore((s) => s.historyIndex);
  const addToHistory = useSceneStore((s) => s.addToHistory);
  const navigateHistory = useSceneStore((s) => s.navigateHistory);

  // useCallback to keep ScannerModel memo stable
  const handleProgress = useRef((curr, tot) => {
    setLoadingProgress({ current: curr, total: tot });
  }).current;

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

  const handleCancelFocus = () => {
    const { clearFocus } = useSceneStore.getState();
    clearFocus();
  };

  const handleHistoryNavigation = useCallback(
    (direction) => {
      navigateHistory(direction);
      const state = navigationHistory[historyIndex + (direction === 'back' ? -1 : 1)];
      if (state) {
        if (state.focus) {
          useSceneStore.getState().setFocus(state.focus);
        } else {
          useSceneStore.getState().clearFocus();
        }
        if (state.segmentVisibility) {
          state.segmentVisibility.forEach((visible, name) => {
            useSceneStore.getState().setSegmentVisibility(name, visible);
          });
        }
      }
    },
    [navigateHistory, navigationHistory, historyIndex]
  );

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
    const cameraState = null;
    const historyState = createHistoryState(currentFocus, segmentVisibility, cameraState);
    addToHistory(historyState);
  }, [currentFocus, segmentVisibility, addToHistory]);

  useEffect(() => {
    if (historyIndex < 0) {
      saveToHistory();
    }
  }, [saveToHistory, historyIndex]);

  return (
    <div className="w-full h-full bg-[#f8fafc] overflow-hidden relative group">
      <SegmentFilterPanel />
      {selectedSegment && (
        <SegmentInfoPanel segmentName={selectedSegment} onClose={() => setSelectedSegment(null)} />
      )}
      {/* History Navigation */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button
          onClick={() => handleHistoryNavigation('back')}
          disabled={!canNavigateBack(historyIndex)}
          className="px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium text-gray-700"
          title="Précédent (Ctrl+Z)"
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
          onClick={() => handleHistoryNavigation('forward')}
          disabled={!canNavigateForward(historyIndex, navigationHistory.length)}
          className="px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium text-gray-700"
          title="Suivant (Ctrl+Shift+Z)"
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
      {/* Reset Focus Overlay */}
      {currentFocus && (
        <button
          onClick={handleCancelFocus}
          className="absolute top-6 right-6 z-30 px-3 py-1.5 rounded-full bg-red-500/90 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all shadow-lg shadow-red-500/20 active:scale-95"
        >
          ✕ Reset Focus
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
          <InitialCameraAdjustment />
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
        
        <SegmentClickHandler onSegmentClick={setSelectedSegment} />
        <FocusCamera />
      </Canvas>
      
      {/* Floating Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-1 p-1.5 bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/40 shadow-xl overflow-hidden">
          <CompactButton onClick={() => handleRotate('reset')} title="Reset" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>} />
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
            onClick={toggleAutoSpin}
            className={`p-2.5 rounded-xl transition-all active:scale-90 ${isAutoSpinning ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 animate-pulse' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Auto-Rotation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
          </button>
        </div>
      </div>

      {/* Control Hint Overlay */}
      <div className="absolute bottom-4 left-4 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100 hidden md:block">
        <div className="bg-white/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 shadow-sm text-[10px] text-slate-500 uppercase tracking-wider font-semibold space-y-1">
          <p>🖱️ Rotation : Clic Gauche</p>
          <p>🖐️ Déplacement : Clic Droit</p>
          <p>🔍 Zoom : Molette</p>
        </div>
      </div>
    </div>
  );
}

function CompactButton({ onClick, icon, title }) {
  return (
    <button
      onClick={onClick}
      className="p-2.5 rounded-xl hover:bg-slate-200 text-slate-600 transition-all active:scale-95 flex items-center justify-center translate-y-0"
      title={title}
    >
      {icon}
    </button>
  );
}
