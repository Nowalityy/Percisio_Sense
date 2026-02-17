/**
 * Camera control: OrbitControls + Z-only zoom to organ + default state for Reset.
 * - Zoom: set store currentFocus → this component runs focusOnOrganZ and animates camera Z + target.
 * - Reset: Viewer3D calls setPendingCameraRestore(getDefaultCameraState()); this applies it in useFrame.
 */
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSceneStore } from '../../store';
import { serializeCameraStateFromScene, applyCameraState } from '../../utils/cameraStateUtils';
import { CAMERA, clampZoomDistance } from './cameraConstants';
import { SEGMENTS } from './medicalColors';

const __DEV__ = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// -----------------------------------------------------------------------------
// Organ lookup (focus key → segment names and scene meshes)
// -----------------------------------------------------------------------------

const CATEGORY_MATCHES = {
  heart: ['heart', 'atrial-appendage'],
  liver: ['liver'],
  lung: ['lung'],
  lungs: ['lung'],
  'left lung': ['of-left-lung', 'left-lung'],
  'right lung': ['of-right-lung', 'right-lung'],
  stomach: ['stomach'],
  pancreas: ['pancreas'],
  spleen: ['spleen'],
  thyroid: ['thyroid'],
  aorta: ['aorta'],
  esophagus: ['esophagus'],
  trachea: ['trachea'],
  adrenal: ['adrenal-gland', 'adrenal'],
  kidney: ['kidney'],
  kidneys: ['kidney'],
  clavicle: ['clavicle'],
  scapula: ['scapula'],
  humerus: ['humerus'],
  sternum: ['sternum'],
  skeleton: ['clavicle', 'scapula', 'humerus', 'sternum', 'spinal-cord'],
  artery: ['artery', 'subclavian', 'carotid', 'aorta', 'brachiocephalic-trunk'],
  vein: ['vein', 'vena-cava', 'brachiocephalic-vein', 'portal-vein'],
  vessel: ['artery', 'vein', 'aorta', 'vena-cava', 'subclavian', 'carotid', 'brachiocephalic', 'portal-vein'],
  pulmonary: ['pulmonary'],
  muscle: ['muscle'],
  spinal: ['spinal-cord'],
  spine: ['spinal-cord'],
  'spinal-cord': ['spinal-cord'],
  trunk: ['brachiocephalic'],
  brachiocephalic: ['brachiocephalic'],
};

function getSegmentNamesForFocus(focusKey) {
  if (!focusKey || typeof focusKey !== 'string') return [];
  const key = focusKey.toLowerCase().trim();
  return SEGMENTS.filter((seg) => {
    const n = seg.toLowerCase();
    if (n === key) return true;
    if (CATEGORY_MATCHES[key]?.some((kw) => n.includes(kw))) return true;
    if (n.includes(key) || key.includes(n)) return true;
    return false;
  });
}

function findOrganMeshes(scene, focusName) {
  if (!scene || !focusName || typeof focusName !== 'string') return [];
  const out = [];
  const low = focusName.toLowerCase();
  scene.traverse((child) => {
    if (!child.isMesh || !child.name) return;
    const n = child.name.toLowerCase();
    if (n === low || CATEGORY_MATCHES[low]?.some((kw) => n.includes(kw))) {
      out.push(child);
      return;
    }
    if (n.includes(low) || low.includes(n)) out.push(child);
  });
  return out;
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
// Zoom: camera moves on Z only (view axis), target = organ center.
// Public API: call with organ center/size and current camera; returns { cameraZ, target }.
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
// Component: OrbitControls + default state + restore + zoom animation
// -----------------------------------------------------------------------------

export function FocusCamera() {
  const controlsRef = useRef(null);
  const defaultStateSavedRef = useRef(false);
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const setGetCameraState = useSceneStore((s) => s.setGetCameraState);
  const setGetDefaultCameraState = useSceneStore((s) => s.setGetDefaultCameraState);
  const { scene, camera } = useThree();

  const [zoomAnimation, setZoomAnimation] = useState(null);
  const [isInteracting, setIsInteracting] = useState(false);

  // Expose current camera state for history/serialization
  useEffect(() => {
    const getState = () =>
      controlsRef.current && camera
        ? serializeCameraStateFromScene(camera, controlsRef.current.target)
        : null;
    setGetCameraState(() => getState);
    return () => setGetCameraState(null);
  }, [camera, setGetCameraState]);

  // On focus change: ensure segments visible, then start Z-only zoom animation
  useEffect(() => {
    if (!currentFocus) {
      setZoomAnimation(null);
      return;
    }
    const controls = controlsRef.current;
    if (!controls || !camera) return;

    const meshes = findOrganMeshes(scene, currentFocus);
    if (meshes.length === 0) {
      getSegmentNamesForFocus(currentFocus).forEach((name) =>
        useSceneStore.getState().setSegmentVisibility(name, true)
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

    // Save default view once (used by Reset)
    if (!defaultStateSavedRef.current) {
      const state = serializeCameraStateFromScene(camera, controls.target);
      setGetDefaultCameraState(() => (state ? { ...state } : null));
      defaultStateSavedRef.current = true;
    }

    // Restore saved view (Reset button / history)
    const pending = useSceneStore.getState().pendingCameraRestore;
    if (pending) {
      applyCameraState(camera, controls, pending);
      useSceneStore.getState().setPendingCameraRestore(null);
      setZoomAnimation(null);
      controls.update();
      return;
    }

    // Zoom animation: only Z and target change; X and Y stay locked
    if (zoomAnimation && !isInteracting && currentFocus) {
      const elapsed = performance.now() - zoomAnimation.startedAt;
      const t = Math.min(elapsed / CAMERA.ZOOM_DURATION_MS, 1);
      const eased = easeInOutCubic(t);

      camera.position.x = zoomAnimation.lockX;
      camera.position.y = zoomAnimation.lockY;
      camera.position.z = zoomAnimation.startZ + (zoomAnimation.endZ - zoomAnimation.startZ) * eased;
      controls.target.lerpVectors(zoomAnimation.startTarget, zoomAnimation.endTarget, eased);

      if (__DEV__) {
        if (camera.position.y !== zoomAnimation.lockY || camera.position.x !== zoomAnimation.lockX) {
          console.warn('[FocusCamera] X or Y changed during zoom (expected locked)');
        }
      }

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
        useSceneStore.getState().requestHistoryPush?.();
      }}
      makeDefault
    />
  );
}
