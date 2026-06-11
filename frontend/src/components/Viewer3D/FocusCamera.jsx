/**
 * Camera control: OrbitControls + Z-only zoom to organ + default state for Reset.
 *
 * - Zoom: set store currentFocus → this component runs focusOnOrganZ and animates camera Z + target.
 * - Reset: Viewer3D calls setPendingCameraRestore(getDefaultCameraState()); this applies it in useFrame.
 */
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSceneStore } from '../../store';
import { getModelRootWorldY } from '../../config/dicomStudies.js';
import { serializeCameraStateFromScene, applyCameraState } from '../../utils/cameraStateUtils';
import {
  CAMERA,
  clampZoomDistance,
  getOrbitDistanceLimits,
  getPolarAngleLimitsFromMeshWorldBox,
} from './cameraConstants';
import { findOrganMeshes } from './focusUtils';
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

function focusOnOrganZ(organCenter, organSize, zoomLevel, framingOptions) {
  if (!organCenter || !(organCenter instanceof THREE.Vector3)) return null;
  return computeFocusTarget(
    organCenter,
    organSize,
    zoomLevel,
    clampZoomDistance,
    CAMERA,
    framingOptions
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const AUTO_SPIN_SPEED = 0.5;

/** Must match `Viewer3D` default `zoomLevel` (38) + ancienne formule `CameraZoomController`. */
const DEFAULT_ZOOM_SLIDER_LEVEL = 38;

/** @param {number} level - slider 0–100 */
function zoomLevelToCameraZoom(level) {
  return 0.8 + (Number(level) / 100) * 0.65;
}

const DEFAULT_CAMERA_ZOOM = zoomLevelToCameraZoom(DEFAULT_ZOOM_SLIDER_LEVEL);

const DEFAULT_BODY_FIT_PADDING = 1.15;

/** Vertical offset (in sphere radii) for the slightly-elevated anterior view. */
const FIT_ELEVATION = 0.07;

export function FocusCamera({ zoomLevel = DEFAULT_ZOOM_SLIDER_LEVEL }) {
  const controlsRef = useRef(null);
  const defaultStateSavedRef = useRef(false);
  const rafThrottleRef = useRef(null);
  /** Dernier `modelGroup` pour lequel on a appliqué le cadrage par défaut. */
  const lastFramedModelRef = useRef(null);
  /** Bounding-sphere radius of `modelGroup` (world) — drives OrbitControls min/max dolly distance. */
  const [modelSphereRadius, setModelSphereRadius] = useState(null);
  /** Full model world AABB — polar limits use mesh `.min`/`.max` Y vs target, not fixed angles. */
  const modelWorldBoxRef = useRef(null);
  /** Updated each frame alongside `controls` — used by toolbar orbit + auto-spin clamps. */
  const polarLimitsRef = useRef({
    min: CAMERA.ORBIT_POLAR_FALLBACK_MIN,
    max: CAMERA.ORBIT_POLAR_FALLBACK_MAX,
  });

  const currentFocus = useSceneStore((s) => s.currentFocus);
  const anatomySegmentSet = useSceneStore((s) => s.anatomySegmentSet);
  const modelGroup = useSceneStore((s) => s.modelGroup);
  const setGetCameraState = useSceneStore((s) => s.setGetCameraState);
  const setGetDefaultCameraState = useSceneStore((s) => s.setGetDefaultCameraState);
  const setCameraOrbitFn = useSceneStore((s) => s.setCameraOrbitFn);
  const cameraAutoSpin = useSceneStore((s) => s.cameraAutoSpin);
  const pendingCameraRestore = useSceneStore((s) => s.pendingCameraRestore);
  const { scene, camera, invalidate, size } = useThree();

  /**
   * demand-mode: a pending camera restore (Home button, history nav) only
   * takes effect inside useFrame — force a frame or the request sits idle.
   */
  useEffect(() => {
    if (pendingCameraRestore) invalidate();
  }, [pendingCameraRestore, invalidate]);

  const [zoomAnimation, setZoomAnimation] = useState(null);
  const [isInteracting, setIsInteracting] = useState(false);
  /** Pour distinguer 1er montage vs changement de segment (cf. dépendances layout). */
  const prevSegmentSetRef = useRef(null);
  /** Snapshots for demand-mode: detect OrbitControls damping deltas after `update()`. */
  const preControlsPos = useRef(new THREE.Vector3());
  const preControlsTarget = useRef(new THREE.Vector3());

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
   *
   * On enlève aussi la pose caméra/orbite du corps précédent sinon OrbitControls
   * et le clamp de distance réappliquent une correction sur une cible obsolète.
   *
   * `OrbitControls` (drei) tient une instance `THREE.OrbitControls` stable par caméra ;
   * avec l’amortissement, sphériques + pan résiduels survivent aux changements de DICOM
   * et le prochain `controls.update()` réécrit la pose — d’où la dérive au 2e passage.
   * On remonte les contrôles via `key={anatomySegmentSet}` et on remet la pose ici en
   * `useLayoutEffect` pour qu’elle soit en place avant le 1er `update()` du frame.
   *
   * Zoom : au changement de segment on impose le zoom « défaut » (38), pas la valeur
   * React du slider encore à jour — sinon un `zoom` obsolète casse le FOV de `fit*` vs
   * la cible, effet de corps qui monte. Entre segment identique, seul le slider s’applique.
   */
  useLayoutEffect(() => {
    const segmentKey = anatomySegmentSet;
    const segmentChanged =
      prevSegmentSetRef.current === null
        ? true
        : prevSegmentSetRef.current !== segmentKey;
    prevSegmentSetRef.current = segmentKey;

    if (segmentChanged) {
      lastFramedModelRef.current = null;
      defaultStateSavedRef.current = false;
      setModelSphereRadius(null);
      modelWorldBoxRef.current = null;
      polarLimitsRef.current = {
        min: CAMERA.ORBIT_POLAR_FALLBACK_MIN,
        max: CAMERA.ORBIT_POLAR_FALLBACK_MAX,
      };
      setGetDefaultCameraState(null);
      setZoomAnimation(null);
      if (useSceneStore.getState().cameraAutoSpin) {
        useSceneStore.getState().setCameraAutoSpin(false);
      }

      const controls = controlsRef.current;
      if (controls && camera) {
        const rootY = getModelRootWorldY(anatomySegmentSet);
        /* Aligné sur `ViewerCanvas` : caméra par défaut (zoom 38) avant le prochain fit. */
         
        camera.up.set(0, 1, 0);
        camera.position.set(0, 0.1, 3.19);
        camera.zoom = DEFAULT_CAMERA_ZOOM;
        camera.updateProjectionMatrix();
        controls.target.set(0, rootY, 0);
        camera.lookAt(controls.target);
        controls.update();
         
        invalidate();
      }
      return;
    }

    /* Même DICOM : zoom optique = slider uniquement (une seule écriture sur la cam). */
    if (camera) {
       
      camera.zoom = zoomLevelToCameraZoom(zoomLevel);
      camera.updateProjectionMatrix();
       
      invalidate();
    }
  }, [anatomySegmentSet, zoomLevel, setGetDefaultCameraState, camera, invalidate]);

  const orbitLimits = useMemo(
    () => getOrbitDistanceLimits(modelSphereRadius, Boolean(currentFocus)),
    [modelSphereRadius, currentFocus]
  );

  /**
   * When overview min distance increases (e.g. leaving organ focus) or max shrinks,
   * pull the camera onto the allowed spherical shell so we never stay inside the hull.
   */
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !camera) return;
    /* Pas de clamp tant que le bound monde du modèle n’est pas connu — évite le décalage avec rayons de repli. */
    if (modelSphereRadius == null) return;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const len = offset.length();
    if (len < 1e-10) return;
    const next = THREE.MathUtils.clamp(len, orbitLimits.min, orbitLimits.max);
    if (Math.abs(next - len) <= 1e-4) return;
    offset.multiplyScalar(next / len);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    controls.update();
    invalidate();
  }, [orbitLimits.min, orbitLimits.max, camera, invalidate, modelSphereRadius]);

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

    /* Même zoom que le slider / reset anatomy — sinon distance FOV ≠ pose et le corps « bouge ». */
    camera.zoom = zoomLevelToCameraZoom(zoomLevel);
    camera.updateProjectionMatrix();

    const fit = fitCameraToBoundingBox(
      box,
      camera,
      DEFAULT_BODY_FIT_PADDING,
      FIT_ELEVATION,
      CAMERA.FIT_VERTICAL_TARGET_BIAS
    );
    if (!fit) return;

    lastFramedModelRef.current = modelGroup;

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    setModelSphereRadius(Number.isFinite(sphere.radius) ? sphere.radius : null);
    modelWorldBoxRef.current = box.clone();

    // `fit.far` assumes the fitted camera distance. Orbit zoom-out can exceed that
    // (see `getOrbitDistanceLimits`). Keep the far plane past max dolly + mesh depth
    // or the mesh clips/disappears when zooming out.
    const rad = Number.isFinite(sphere.radius) && sphere.radius > 0 ? sphere.radius : null;
    const orbitMax = getOrbitDistanceLimits(rad, false).max;
    const farForZoomOut = orbitMax + (rad ?? 1) * 12 + 8;

    /* r3f THREE.Camera: intentional default framing on model load. */
    camera.up.set(0, 1, 0);
    camera.position.copy(fit.position);
    camera.near = fit.near;
    camera.far = Math.max(fit.far, farForZoomOut);
    camera.updateProjectionMatrix();
    controls.target.copy(fit.target);
    camera.lookAt(controls.target);

    // OrbitControls.update() enforces min/max polar φ. If the fitted pose sits outside
    // that band, the next frame silently pulls the camera — model drifts (often upward).
    const offsetFit = new THREE.Vector3().subVectors(camera.position, controls.target);
    const sphFit = new THREE.Spherical().setFromVector3(offsetFit);
    const polarFit = getPolarAngleLimitsFromMeshWorldBox(
      box,
      sphFit.radius,
      controls.target.y
    );
    const phiClamped = THREE.MathUtils.clamp(sphFit.phi, polarFit.min, polarFit.max);
    if (Math.abs(phiClamped - sphFit.phi) > 1e-7) {
      sphFit.phi = phiClamped;
      offsetFit.setFromSpherical(sphFit);
      camera.position.copy(controls.target).add(offsetFit);
      camera.lookAt(controls.target);
    }
    polarLimitsRef.current = polarFit;

    controls.update();
    setZoomAnimation(null);
    // Capture this fitted view as the "Reset view" default on the next frame.
    defaultStateSavedRef.current = false;
    invalidate();
    // zoomLevel lu au cadrage mais volontairement hors deps : le slider ne doit pas relancer le fit (zoom optique seulement).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit seulement chargement modèle / resize canvas
  }, [modelGroup, camera, invalidate, size.width, size.height]);

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
        const { min: phiMin, max: phiMax } = polarLimitsRef.current;
        spherical.phi = Math.max(phiMin, Math.min(phiMax, spherical.phi + dPhi));
        offset.setFromSpherical(spherical);
      }
      camera.position.copy(target).add(offset);
      if (dRoll !== 0) {
        const viewDir = new THREE.Vector3().subVectors(target, camera.position).normalize();
        camera.up.applyAxisAngle(viewDir, dRoll).normalize();
      }
      camera.lookAt(target);
      controls.update();
      invalidate();
    };
    setCameraOrbitFn(applyOrbit);
    return () => setCameraOrbitFn(null);
  }, [camera, setCameraOrbitFn, invalidate]);

  /** Zoom organe : réessaie plusieurs frames — les meshes peuvent arriver après `currentFocus` ou `modelGroup`. */
  useEffect(() => {
    if (!currentFocus) {
      setZoomAnimation(null);
      return undefined;
    }
    const controls = controlsRef.current;
    if (!controls || !camera) return undefined;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 28;

    const tick = () => {
      if (cancelled) return;

      const meshes = findOrganMeshes(scene, currentFocus);
      const box = meshes.length > 0 ? getVisibleMeshesBoundingBox(meshes) : null;

      if (meshes.length === 0 || !box) {
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) {
          requestAnimationFrame(tick);
          return;
        }
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[FocusCamera] Organ focus: no matching meshes after retries; leaving visibility unchanged', {
            focus: currentFocus,
          });
        }
        invalidate();
        return;
      }

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const orbitClamp =
        modelSphereRadius != null && Number.isFinite(modelSphereRadius) && modelSphereRadius > 0
          ? getOrbitDistanceLimits(modelSphereRadius, true)
          : null;
      const result = focusOnOrganZ(center, size, CAMERA.FOCUS_ORGAN_ZOOM_LEVEL, {
        framingCamera: camera,
        framingPadding: CAMERA.FOCUS_ORGAN_FRAMING_PADDING,
        framingElevation: FIT_ELEVATION,
        orbitDistanceClamp: orbitClamp,
        distanceMultiplier: CAMERA.FOCUS_ORGAN_DISTANCE_MULTIPLIER,
        minDistanceFactor: CAMERA.FOCUS_ORGAN_MIN_DISTANCE_FACTOR,
        bodySphereRadius: modelSphereRadius,
        tinyMeshMaxRelToBody: CAMERA.FOCUS_TINY_MESH_MAX_REL_TO_BODY,
        tinyMeshMinRhoFrac: CAMERA.FOCUS_TINY_MESH_MIN_RHO_FRAC,
      });
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
      invalidate();
    };

    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [currentFocus, scene, camera, modelGroup, modelSphereRadius, invalidate]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !camera) return;

    const rho = camera.position.distanceTo(controls.target);
    const polar = getPolarAngleLimitsFromMeshWorldBox(
      modelWorldBoxRef.current,
      rho,
      controls.target.y
    );
    controls.minPolarAngle = polar.min;
    controls.maxPolarAngle = polar.max;
    polarLimitsRef.current = polar;

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
      invalidate();
      return;
    }

    if (zoomAnimation && !isInteracting && currentFocus) {
      const elapsed = performance.now() - zoomAnimation.startedAt;
      const t = Math.min(elapsed / CAMERA.ZOOM_DURATION_MS, 1);
      const eased = easeInOutCubic(t);

      // r3f exposes mutable THREE objects by design — direct mutation is expected.
       
      camera.position.x = zoomAnimation.startX + (zoomAnimation.endX - zoomAnimation.startX) * eased;
      camera.position.y = zoomAnimation.startY + (zoomAnimation.endY - zoomAnimation.startY) * eased;
      camera.position.z = zoomAnimation.startZ + (zoomAnimation.endZ - zoomAnimation.startZ) * eased;
      controls.target.lerpVectors(zoomAnimation.startTarget, zoomAnimation.endTarget, eased);
       

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
      const pl = polarLimitsRef.current;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, pl.min, pl.max);
      offset.setFromSpherical(spherical);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      controls.update();
      // PERF: Keep demand-loop active while auto-spinning.
      invalidate();
      return;
    }

    preControlsPos.current.copy(camera.position);
    preControlsTarget.current.copy(controls.target);
    controls.update();
    if (controls.enableDamping && !isInteracting) {
      const moved =
        preControlsPos.current.distanceToSquared(camera.position) > 1e-10 ||
        preControlsTarget.current.distanceToSquared(controls.target) > 1e-10;
      if (moved) {
        invalidate();
      }
    }
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
      key={anatomySegmentSet}
      ref={controlsRef}
      enablePan
      enableDamping
      enableZoom
      enableRotate
      dampingFactor={0.1}
      minDistance={orbitLimits.min}
      maxDistance={orbitLimits.max}
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
