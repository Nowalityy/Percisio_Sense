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
import { useSceneStore } from '../../store';
import { serializeCameraStateFromScene, applyCameraState } from '../../utils/cameraStateUtils';
import { CAMERA, clampZoomDistance } from './cameraConstants';
import { getSegmentNamesForFocus, findOrganMeshes } from './focusUtils';
import {
  easeInOutCubic,
  getVisibleMeshesBoundingBox,
  computeFocusTarget,
} from '../../viewer-core/cameraCore';

// -----------------------------------------------------------------------------
// Helper: compute target camera Z and look-at for organ focus (Z-only zoom).
// -----------------------------------------------------------------------------

function focusOnOrganZ(organCenter, organSize, zoomLevel) {
  if (!organCenter || !(organCenter instanceof THREE.Vector3)) return null;
  return computeFocusTarget(organCenter, organSize, zoomLevel, clampZoomDistance, CAMERA);
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function FocusCamera() {
  const controlsRef = useRef(null);
  const defaultStateSavedRef = useRef(false);
  const rafThrottleRef = useRef(null);
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const setGetCameraState = useSceneStore((s) => s.setGetCameraState);
  const setGetDefaultCameraState = useSceneStore((s) => s.setGetDefaultCameraState);
  const { scene, camera, invalidate } = useThree();

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
      const visibleSegments = getSegmentNamesForFocus(currentFocus);
      const visibilityMap = new Map(visibleSegments.map((segmentName) => [segmentName, true]));
      useSceneStore.getState().setManySegmentVisibility(visibilityMap);
      return;
    }

    const box = getVisibleMeshesBoundingBox(meshes);
    if (!box) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const result = focusOnOrganZ(
      center,
      size,
      1
    );
    if (!result) return;

    setZoomAnimation({
      startX: camera.position.x,
      endX: result.cameraPosition.x,
      startY: camera.position.y,
      endY: result.cameraPosition.y,
      startZ: camera.position.z,
      endZ: result.cameraPosition.z,
      startTarget: controls.target.clone(),
      endTarget: result.target,
      startedAt: performance.now(),
    });
    // PERF: Trigger demand-loop render for focus transition.
    invalidate();
  }, [currentFocus, scene, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (!defaultStateSavedRef.current) {
      const state = serializeCameraStateFromScene(camera, controls.target);
      setGetDefaultCameraState(() => (state ? { ...state } : null));
      defaultStateSavedRef.current = true;
    }

    const pending = useSceneStore.getState().pendingCameraRestore;
    if (pending) {
      applyCameraState(camera, controls, pending);
      useSceneStore.getState().setPendingCameraRestore(null);
      setZoomAnimation(null);
      controls.update();
      return;
    }

    if (zoomAnimation && !isInteracting && currentFocus) {
      const elapsed = performance.now() - zoomAnimation.startedAt;
      const t = Math.min(elapsed / CAMERA.ZOOM_DURATION_MS, 1);
      const eased = easeInOutCubic(t);

      // r3f exposes mutable THREE objects by design — direct mutation is expected.
      /* eslint-disable react-hooks/immutability */
      camera.position.x = zoomAnimation.startX + (zoomAnimation.endX - zoomAnimation.startX) * eased;
      camera.position.y = zoomAnimation.startY + (zoomAnimation.endY - zoomAnimation.startY) * eased;
      camera.position.z = zoomAnimation.startZ + (zoomAnimation.endZ - zoomAnimation.startZ) * eased;
      controls.target.lerpVectors(zoomAnimation.startTarget, zoomAnimation.endTarget, eased);
      /* eslint-enable react-hooks/immutability */

      if (t >= 1) setZoomAnimation(null);
      controls.update();
      // PERF: Keep demand-loop active while animation is running.
      invalidate();
      return;
    }

    controls.update();
  });

  useEffect(() => {
    return () => {
      if (rafThrottleRef.current != null) {
        cancelAnimationFrame(rafThrottleRef.current);
      }
    };
  }, []);

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
      onChange={() => {
        // PERF: Throttle control-driven re-renders to ~60 FPS.
        if (rafThrottleRef.current != null) return;
        rafThrottleRef.current = requestAnimationFrame(() => {
          rafThrottleRef.current = null;
          invalidate();
        });
      }}
      makeDefault
    />
  );
}
