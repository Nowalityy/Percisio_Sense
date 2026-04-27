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
  fitCameraToBoundingBox,
  getWorldBoundingBox,
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

const AUTO_SPIN_SPEED = 0.5;

/** Must match `CameraZoomController` + `Viewer3D` default `zoomLevel` (38). */
const DEFAULT_ZOOM_SLIDER_LEVEL = 38;
const DEFAULT_CAMERA_ZOOM = 0.8 + (DEFAULT_ZOOM_SLIDER_LEVEL / 100) * 0.65;

/** Padding factor around the bounding sphere when fitting (1 = tight). */
const FIT_PADDING = 1.15;
/** Vertical offset (in sphere radii) for the slightly-elevated anterior view. */
const FIT_ELEVATION = 0.12;

export function FocusCamera() {
  const controlsRef = useRef(null);
  const defaultStateSavedRef = useRef(false);
  const rafThrottleRef = useRef(null);
  /** Dernier `modelGroup` pour lequel on a appliqué le cadrage par défaut. */
  const lastFramedModelRef = useRef(null);
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const anatomySegmentSet = useSceneStore((s) => s.anatomySegmentSet);
  const modelGroup = useSceneStore((s) => s.modelGroup);
  const setGetCameraState = useSceneStore((s) => s.setGetCameraState);
  const setGetDefaultCameraState = useSceneStore((s) => s.setGetDefaultCameraState);
  const setCameraOrbitFn = useSceneStore((s) => s.setCameraOrbitFn);
  const cameraAutoSpin = useSceneStore((s) => s.cameraAutoSpin);
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

  /**
   * Reset `lastFramedModelRef` when the user picks a different DICOM so the
   * next time `modelGroup` is published (after segments finish loading) we
   * re-frame the camera even if the new group instance is reused.
   */
  useEffect(() => {
    lastFramedModelRef.current = null;
    defaultStateSavedRef.current = false;
    setGetDefaultCameraState(null);
    if (useSceneStore.getState().cameraAutoSpin) {
      useSceneStore.getState().setCameraAutoSpin(false);
    }
  }, [anatomySegmentSet, setGetDefaultCameraState]);

  /**
   * Default framing once the model is fully loaded. We compute the world-space
   * bounding box of the centered & scaled model group and fit the camera to
   * its bounding sphere from a frontal slightly-elevated medical view. This
   * replaces the previous hardcoded `(0, ty+0.1, 3.19)` position so each
   * DICOM export ends up perfectly centered in the viewport regardless of its
   * native scale or origin.
   */
  useEffect(() => {
    if (!modelGroup || !camera) return;
    if (lastFramedModelRef.current === modelGroup) return;
    const controls = controlsRef.current;
    if (!controls) return;

    // Make sure all matrices reflect the freshly-applied centering/scaling.
    modelGroup.updateMatrixWorld(true);
    const box = getWorldBoundingBox(modelGroup);
    if (!box) return;

    const fit = fitCameraToBoundingBox(box, camera, FIT_PADDING, FIT_ELEVATION);
    if (!fit) return;

    lastFramedModelRef.current = modelGroup;

    /* r3f THREE.Camera: intentional default framing on model load. */
    /* eslint-disable react-hooks/immutability */
    camera.up.set(0, 1, 0);
    camera.position.copy(fit.position);
    camera.zoom = DEFAULT_CAMERA_ZOOM;
    camera.near = fit.near;
    camera.far = fit.far;
    camera.updateProjectionMatrix();
    controls.target.copy(fit.target);
    camera.lookAt(controls.target);
    controls.update();
    /* eslint-enable react-hooks/immutability */
    setZoomAnimation(null);
    // Capture this fitted view as the "Reset view" default on the next frame.
    defaultStateSavedRef.current = false;
    invalidate();
  }, [modelGroup, camera, invalidate]);

  useEffect(() => {
    /**
     * Orbit the camera around the current OrbitControls target. Model stays fixed.
     * - dTheta: horizontal azimuth delta (radians)
     * - dPhi:   vertical polar delta (radians)
     * - dRoll:  roll around the view axis (radians)
     */
    const applyOrbit = ({ dTheta = 0, dPhi = 0, dRoll = 0 } = {}) => {
      const controls = controlsRef.current;
      if (!controls || !camera) return;
      setZoomAnimation(null);
      const target = controls.target;
      const offset = new THREE.Vector3().subVectors(camera.position, target);
      if (dTheta !== 0 || dPhi !== 0) {
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta += dTheta;
        spherical.phi = Math.max(
          CAMERA.ORBIT_MIN_POLAR,
          Math.min(CAMERA.ORBIT_MAX_POLAR, spherical.phi + dPhi)
        );
        offset.setFromSpherical(spherical);
      }
      /* eslint-disable react-hooks/immutability */
      camera.position.copy(target).add(offset);
      if (dRoll !== 0) {
        const viewDir = new THREE.Vector3().subVectors(target, camera.position).normalize();
        camera.up.applyAxisAngle(viewDir, dRoll).normalize();
      }
      camera.lookAt(target);
      /* eslint-enable react-hooks/immutability */
      controls.update();
      invalidate();
    };
    setCameraOrbitFn(applyOrbit);
    return () => setCameraOrbitFn(null);
  }, [camera, setCameraOrbitFn, invalidate]);

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

  useFrame((_, delta) => {
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

    if (cameraAutoSpin && !isInteracting) {
      const target = controls.target;
      const offset = new THREE.Vector3().subVectors(camera.position, target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += delta * AUTO_SPIN_SPEED;
      offset.setFromSpherical(spherical);
      /* eslint-disable react-hooks/immutability */
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      /* eslint-enable react-hooks/immutability */
      controls.update();
      // PERF: Keep demand-loop active while auto-spinning.
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
        if (useSceneStore.getState().cameraAutoSpin) {
          useSceneStore.getState().setCameraAutoSpin(false);
        }
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
