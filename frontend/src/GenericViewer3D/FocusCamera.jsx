/**
 * Camera control: OrbitControls + Z-only zoom to organ + default state for Reset.
 *
 * - Zoom: set store currentFocus → this component runs focusOnOrganZ and animates camera Z + target.
 * - Reset: Viewer3D calls setPendingCameraRestore(getDefaultCameraState()); this applies it in useFrame.
 */
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useViewerStore } from './viewerStore';
import { serializeCameraStateFromScene, applyCameraState } from './cameraStateUtils';
import { CAMERA, clampZoomDistance } from './cameraConstants';
import { getSegmentNamesForFocus, findOrganMeshes } from './focusUtils';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getOrganBoundingBox(meshes) {
  if (!meshes?.length) return null;
  const box = new THREE.Box3();
  for (const m of meshes) {
    if (m.visible && m.geometry) box.expandByObject(m);
  }
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim < 1e-6) return null;
  return box;
}

// -----------------------------------------------------------------------------
// Public API: compute target camera Z and look-at for organ focus (Z-only zoom).
// -----------------------------------------------------------------------------

export function focusOnOrganZ(organCenter, organSize, zoomLevel, lockX, lockY, currentCameraZ) {
  if (!organCenter || !(organCenter instanceof THREE.Vector3)) return null;
  const dist = clampZoomDistance(zoomLevel);
  const dx = lockX - organCenter.x;
  const dy = lockY - organCenter.y;
  const r2 = dist * dist - dx * dx - dy * dy;
  const dz = r2 > 0 ? Math.sqrt(r2) : dist;
  const sign = currentCameraZ > organCenter.z ? 1 : -1;
  return {
    cameraZ: organCenter.z + sign * dz,
    target: organCenter.clone(),
  };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function FocusCamera() {
  const controlsRef = useRef(null);
  const defaultStateSavedRef = useRef(false);
  const currentFocus = useViewerStore((s) => s.currentFocus);
  const setGetCameraState = useViewerStore((s) => s.setGetCameraState);
  const setGetDefaultCameraState = useViewerStore((s) => s.setGetDefaultCameraState);
  const { scene, camera } = useThree();

  const [zoomAnimation, setZoomAnimation] = useState(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const getState = () =>
      controlsRef.current && camera
        ? serializeCameraStateFromScene(camera, controlsRef.current.target)
        : null;
    setGetCameraState(() => getState);
    return () => setGetCameraState(null);
  }, [camera, setGetCameraState]);

  useEffect(() => {
    if (!currentFocus) {
      setZoomAnimation(null);
      return;
    }
    const controls = controlsRef.current;
    if (!controls || !camera) return;

    const meshes = findOrganMeshes(scene, currentFocus);
    if (meshes.length === 0) {
      getSegmentNamesForFocus(currentFocus).forEach((segmentName) =>
        useViewerStore.getState().setSegmentVisibility(segmentName, true)
      );
      return;
    }

    const box = getOrganBoundingBox(meshes);
    if (!box) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const result = focusOnOrganZ(
      center,
      size,
      1,
      camera.position.x,
      camera.position.y,
      camera.position.z
    );
    if (!result) return;

    setZoomAnimation({
      startZ: camera.position.z,
      endZ: result.cameraZ,
      startTarget: controls.target.clone(),
      endTarget: result.target,
      lockX: camera.position.x,
      lockY: camera.position.y,
      startedAt: performance.now(),
    });
  }, [currentFocus, scene, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (!defaultStateSavedRef.current) {
      const state = serializeCameraStateFromScene(camera, controls.target);
      setGetDefaultCameraState(() => (state ? { ...state } : null));
      defaultStateSavedRef.current = true;
    }

    const pending = useViewerStore.getState().pendingCameraRestore;
    if (pending) {
      applyCameraState(camera, controls, pending);
      useViewerStore.getState().setPendingCameraRestore(null);
      setZoomAnimation(null);
      controls.update();
      return;
    }

    if (zoomAnimation && !isInteracting && currentFocus) {
      const elapsed = performance.now() - zoomAnimation.startedAt;
      const t = Math.min(elapsed / CAMERA.ZOOM_DURATION_MS, 1);
      const eased = easeInOutCubic(t);

      camera.position.x = zoomAnimation.lockX;
      camera.position.y = zoomAnimation.lockY;
      camera.position.z = zoomAnimation.startZ + (zoomAnimation.endZ - zoomAnimation.startZ) * eased;
      controls.target.lerpVectors(zoomAnimation.startTarget, zoomAnimation.endTarget, eased);

      if (t >= 1) setZoomAnimation(null);
      controls.update();
      return;
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableDamping
      enableZoom
      enableRotate
      dampingFactor={0.1}
      minDistance={CAMERA.ORBIT_MIN_DISTANCE}
      maxDistance={CAMERA.ORBIT_MAX_DISTANCE}
      minPolarAngle={CAMERA.ORBIT_MIN_POLAR}
      maxPolarAngle={CAMERA.ORBIT_MAX_POLAR}
      onStart={() => {
        setIsInteracting(true);
        setZoomAnimation(null);
      }}
      onEnd={() => {
        setIsInteracting(false);
        useViewerStore.getState().requestHistoryPush?.();
      }}
      makeDefault
    />
  );
}
