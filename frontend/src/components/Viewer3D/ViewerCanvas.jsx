import * as THREE from 'three';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { SceneLights } from './SceneLights';
import { ScannerModel } from './ScannerModel';
import { FocusCamera } from './FocusCamera';

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
  children,
}) {
  return (
    <Canvas
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
      {/* Small upward Y offset so the body sits clear of the bottom/top toolbars
          and appears visually centered in the viewport. */}
      <group position={[0, 0.7, 0]}>
        <ModelErrorBoundary>
          <Suspense
            fallback={
              <CanvasLoader current={loadingProgress.current} total={loadingProgress.total} />
            }
          >
            <ScannerModel
              rotation={rotation}
              isAutoSpinning={isAutoSpinning}
              onProgress={onProgress}
            />
          </Suspense>
        </ModelErrorBoundary>
      </group>
      <FocusCamera />
      {children}
    </Canvas>
  );
}
