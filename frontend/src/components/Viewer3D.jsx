import { Suspense, useRef, useEffect, useState, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html, useGLTF, AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../store.js';

/**
 * Exemple de mapping organes -> objets 3D.
 */
const ORGAN_MAPPING = {
  foie: 'liver',
  poumon: 'lung',
  rein: 'kidney',
  cerveau: 'brain',
  coeur: 'heart',
};

/**
 * ErrorBoundary pour capturer les erreurs de chargement du modèle
 */
class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('Erreur lors du chargement du modèle:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900 max-w-md shadow-sm">
            <p className="font-semibold mb-2">Erreur de chargement</p>
            <p className="text-xs text-red-700">
              Le modèle est trop volumineux pour être chargé.
            </p>
          </div>
        </Html>
      );
    }

    return this.props.children;
  }
}

/**
 * Composant pour charger et afficher le modèle Model.glb
 */
function ScannerModel({ rotation = { x: 0, y: 0, z: 0 }, isAutoSpinning }) {
  const { scene } = useGLTF('/models/Model.glb', true);
  const groupRef = useRef();

  // Appliquer la rotation via manual state + auto-spin
  useFrame((state, delta) => {
    if (groupRef.current) {
      if (isAutoSpinning) {
        groupRef.current.rotation.y += delta * 0.5;
      } else {
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rotation.x, 0.1);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation.y, 0.1);
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, rotation.z, 0.1);
      }
    }
  });

  // Centrer et ajuster le modèle après chargement
  useEffect(() => {
    if (scene) {
      try {
        // Nettoyer les éléments indésirables (comme un cube blanc interne)
        // ET AUDIT DES NOMS (Temporary)
        // console.group("🔍 3D Model Audit - Mesh Names");
        scene.traverse((child) => {
          if (child.isMesh) {
            // console.log(`Mesh found: "${child.name}"`, { type: child.type, parent: child.parent?.name });
            
            // Si le nom contient Cube ou Box, on le cache
            if (child.name.toLowerCase().includes('cube') || child.name.toLowerCase().includes('box')) {
              child.visible = false;
            }
          }
        });
        // console.groupEnd();

        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        scene.position.sub(center);
        
        const maxDimension = Math.max(size.x, size.y, size.z);
        let scale = 1;
        
        if (maxDimension > 10) scale = 5 / maxDimension;
        else if (maxDimension > 5) scale = 3 / maxDimension;
        else if (maxDimension < 0.1) scale = 2 / maxDimension;
        else if (maxDimension < 1) scale = 1.5 / maxDimension;
        
        scene.scale.set(scale, scale, scale);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('❌ Erreur lors du centrage du modèle:', err);
      }
    }
  }, [scene]);

  if (!scene) return null;

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/models/Model.glb', true);

function ModelErrorDisplay() {
  return (
    <div className="px-6 py-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900 max-w-2xl shadow-sm">
      <p className="font-semibold mb-2 text-base">Erreur de chargement du modèle</p>
      <p className="text-xs text-red-700 mb-2">
        Le fichier Model.glb est trop volumineux pour être chargé directement dans le navigateur.
      </p>
      <p className="text-xs text-red-600 mb-3">
        Veuillez compresser le modèle avant de l'utiliser.
      </p>
    </div>
  );
}

function Scene({ rotation, isAutoSpinning }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight intensity={1.2} position={[5, 5, 5]} />
      <spotLight position={[-5, 5, 5]} angle={0.25} penumbra={1} intensity={1} color="#38bdf8" />
      <Environment preset="city" />

      <group position={[0, 0, 0]}>
        <ModelErrorBoundary>
          <Suspense fallback={<CanvasLoader />}>
            <ScannerModel rotation={rotation} isAutoSpinning={isAutoSpinning} />
          </Suspense>
        </ModelErrorBoundary>
      </group>
    </>
  );
}

function CanvasLoader() {
  return (
    <Html center>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 animate-pulse bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm">
        Chargement 3D…
      </div>
    </Html>
  );
}

function FocusCamera() {
  const controlsRef = useRef();
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const wasFocusingRef = useRef(false);

  const focusPositions = {
    foie: new THREE.Vector3(1.4, 0.3, 1.8),
    poumon: new THREE.Vector3(1.6, 0.8, 1.8),
    rein: new THREE.Vector3(1.4, -0.7, 1.8),
    cerveau: new THREE.Vector3(1.2, 1.4, 1.8),
    coeur: new THREE.Vector3(0.5, 0.5, 2.0),
    default: new THREE.Vector3(0, 0.8, 4.5),
  };

  useFrame((state) => {
    const { camera } = state;
    if (currentFocus && focusPositions[currentFocus]) {
      wasFocusingRef.current = true;
      camera.position.lerp(focusPositions[currentFocus], 0.04);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        controlsRef.current.update();
      }
    } else {
      if (wasFocusingRef.current && controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        wasFocusingRef.current = false;
      }
      if (controlsRef.current) controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableDamping={true}
      enableZoom={true}
      dampingFactor={0.12}
      rotateSpeed={0.7}
      zoomSpeed={1.2}
      minDistance={0.01}
      maxDistance={2000}
      target={[0, 0, 0]}
    />
  );
}

export function focusOnOrgan(organKey) {
  const { setFocus } = useSceneStore.getState();
  setFocus(organKey);
}

export default function Viewer3D() {
  const containerRef = useRef(null);
  const [hasError, setHasError] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [dpr, setDpr] = useState(1.5);
  const [hoveredMesh, setHoveredMesh] = useState(null); // INFO: Inspector State
  const currentFocus = useSceneStore((s) => s.currentFocus);

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
  
  // OPTIMISATION : On utilise onClick au lieu de onPointerMove pour éviter le lag
  const handleInspectorClick = (e) => {
    e.stopPropagation();
    if (e.object?.name) {
      console.log('Clicked mesh:', e.object.name);
      setHoveredMesh(e.object.name);
    }
  };

  const clearInspector = () => {
    setHoveredMesh(null);
  };

  useEffect(() => {
    const { clearFocus } = useSceneStore.getState();
    clearFocus();
  }, []);

  useEffect(() => {
    const handleError = (event) => {
      if (event.message?.includes('Model.glb') || event.message?.includes('typed array')) {
        setHasError(true);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="w-full h-full bg-slate-50 flex items-center justify-center p-4">
        <ModelErrorDisplay />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-100 relative overflow-hidden">
      {/* INSPECTOR UI - REMOVED TEMPORARILY
      <div className="absolute top-4 left-4 z-40 bg-black/70 text-white px-3 py-1.5 rounded-md text-xs font-mono pointer-events-none transition-opacity duration-200 backdrop-blur-sm border border-white/20">
        SCANNER INSPECTOR
        {hoveredMesh ? (
          <div className="text-green-400 font-bold mt-1">ID: {hoveredMesh}</div>
        ) : (
          <div className="text-gray-400 italic mt-1">Cliquez sur un organe...</div>
        )}
      </div>
      */}

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
        dpr={dpr}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 2, 8], fov: 50, near: 0.001, far: 5000 }}
        onError={() => setHasError(true)}
      >
        <PerformanceMonitor onIncline={() => setDpr(2)} onDecline={() => setDpr(1)} />
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <Suspense fallback={<CanvasLoader />}>
          <FocusCamera />
          {/* Pass pointer events to the group wrapping the scene */}
          <group 
            // onClick={handleInspectorClick}
            // onPointerMissed={clearInspector}
          >
             <Scene rotation={rotation} isAutoSpinning={isAutoSpinning} />
          </group>
        </Suspense>
      </Canvas>

      {/* Minimalism floating bar */}
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
    </div>
  );
}

function CompactButton({ onClick, icon, title }) {
  return (
    <button
      onClick={onClick}
      className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all active:scale-90"
      title={title}
    >
      {icon}
    </button>
  );
}
