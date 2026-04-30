import * as THREE from 'three';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { SceneLights } from './SceneLights';
import { ScannerModel } from './ScannerModel';
import { FocusCamera } from './FocusCamera';
import { getModelRootWorldY } from '../../config/dicomStudies.js';

export function ViewerCanvas({
  isLowEndDevice,
  maxDpr,
  rendererRef,
  loadingProgress,
  modelErrorBoundary: ModelErrorBoundary,
  canvasLoader: CanvasLoader,
  rotation,
  isAutoSpinning,
  onProgress,
  anatomySegmentSet,
  /** Vue 3D : 0–100, même formule que l’ancien `CameraZoomController` (évite double écriture sur `camera.zoom`). */
  zoomLevel = 38,
  /** Increment to remount Canvas + WebGL after load/render failures. */
  recoveryKey = 0,
  onRecoverModel,
  children,
}) {
  const modelGroupY = getModelRootWorldY(anatomySegmentSet);

  return (
    <Canvas
      key={`viewer-canvas-${recoveryKey}`}
      shadows={false}
      frameloop="demand"
      dpr={[1, maxDpr]}
      camera={{ position: [0, 0.1, 3.19], fov: 50, near: 0.01, far: 2000 }}
      gl={{
        antialias: !isLowEndDevice,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        logarithmicDepthBuffer: false,
        preserveDrawingBuffer: false,
      }}
      onCreated={({ scene, gl }) => {
        scene.background = new THREE.Color('#f1f5f9');
        gl.shadowMap.enabled = false;
        gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
        rendererRef.current = gl;
      }}
    >
      <SceneLights />
      {/* Base Y lift + optional per-segment-set offset (see dicomStudies.js). */}
      <group position={[0, modelGroupY, 0]}>
        <ModelErrorBoundary onRecover={onRecoverModel}>
          <Suspense
            fallback={
              <CanvasLoader current={loadingProgress.current} total={loadingProgress.total} />
            }
          >
            <ScannerModel
              key={anatomySegmentSet}
              rotation={rotation}
              isAutoSpinning={isAutoSpinning}
              onProgress={onProgress}
            />
          </Suspense>
        </ModelErrorBoundary>
      </group>
      <FocusCamera zoomLevel={zoomLevel} />
      {children}
    </Canvas>
  );
}
