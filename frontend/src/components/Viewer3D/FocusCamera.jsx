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

/** Body framing margin around the bounding sphere (1 = tight). Lower ⇒ bigger body. */
const DEFAULT_BODY_FIT_PADDING = 1.05;

/** Vertical offset (in sphere radii) for the slightly-elevated anterior view (organ focus). */
const FIT_ELEVATION = 0.07;

/** Body default-view elevation: near head-on so the body stays vertically centered. */
const DEFAULT_BODY_FIT_ELEVATION = 0.02;

export function FocusCamera({ zoomLevel = DEFAULT_ZOOM_SLIDER_LEVEL }) {
  const controlsRef = useRef(null);
  const defaultStateSavedRef = useRef(false);
  const rafThrottleRef = useRef(null);
  /** Last `modelGroup` for which the default framing was applied. */
  const lastFramedModelRef = useRef(null);
  /**
   * True once the user takes control (orbit / organ focus / auto-spin). While it
   * is false we keep the right to RE-fit when the canvas size changes — this is
   * the safety net against the F5 race: with a warm cache the model can appear
   * before the layout (flex, scrollbar, fonts) settles, so the first fit may use
   * a transient size; the final `ResizeObserver` then re-runs the fit. Once the
   * user has moved the camera we stop auto-fitting so we never steal their view.
   */
  const userAdjustedRef = useRef(false);
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
  const setCaptureViewer = useSceneStore((s) => s.setCaptureViewer);
  const cameraAutoSpin = useSceneStore((s) => s.cameraAutoSpin);
  const pendingCameraRestore = useSceneStore((s) => s.pendingCameraRestore);
  const { gl, scene, camera, invalidate, size } = useThree();

  /**
   * demand-mode: a pending camera restore (Home button, history nav) only
   * takes effect inside useFrame — force a frame or the request sits idle.
   */
  useEffect(() => {
    if (pendingCameraRestore) invalidate();
  }, [pendingCameraRestore, invalidate]);

  /**
   * PER-56: expose a synchronous snapshot for the PDF export. In demand
   * frameloop the drawing buffer is empty between frames, so a plain
   * toDataURL() reads black — render one fresh frame first, then read it.
   */
  useEffect(() => {
    const capture = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    };
    // store action wraps in a thunk so zustand keeps the fn as plain data.
    setCaptureViewer(capture);
    return () => setCaptureViewer(null);
  }, [gl, scene, camera, setCaptureViewer]);

  const [zoomAnimation, setZoomAnimation] = useState(null);
  const [isInteracting, setIsInteracting] = useState(false);
  /** Distinguishes first mount vs segment change (see layout-effect deps). */
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
   * We also clear the previous body's camera/orbit pose, otherwise OrbitControls
   * and the distance clamp re-apply a correction against a stale target.
   *
   * `OrbitControls` (drei) keeps a stable `THREE.OrbitControls` instance per camera;
   * with damping, residual spherical + pan values survive DICOM changes and the
   * next `controls.update()` rewrites the pose — hence the drift on the 2nd pass.
   * We remount the controls via `key={anatomySegmentSet}` and reset the pose here in
   * `useLayoutEffect` so it is in place before the frame's first `update()`.
   *
   * Zoom: on a segment change we force the "default" zoom (38), not the still-current
   * React slider value — otherwise a stale `zoom` breaks the `fit*` FOV vs the target
   * (body drifts up). Within the same segment, only the slider applies.
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
      userAdjustedRef.current = false;
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
        /* Aligned with `ViewerCanvas`: default camera (zoom 38) before the next fit. */
         
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

    /* Same DICOM: optical zoom = slider only (a single write to the camera). */
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
    /* No clamp until the model's world bound is known — avoids the offset with fallback radii. */
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
    const controls = controlsRef.current;
    if (!controls) return;

    /*
     * Re-fit if: new model, OR the canvas size changed while the user has not
     * taken control yet. The 2nd case fixes the F5 race (warm cache): the first
     * fit can land on a transient aspect, and it is the final `ResizeObserver`
     * (deps `size.*`) that re-runs this with the correct size. Read live store
     * state so a stale focus / auto-spin closure cannot wrongly skip the re-fit.
     */
    const live = useSceneStore.getState();
    const userControlled =
      userAdjustedRef.current || Boolean(live.currentFocus) || live.cameraAutoSpin;
    if (lastFramedModelRef.current === modelGroup && userControlled) return;

    /*
     * Never lock in a fit computed on a degenerate canvas size: `camera.aspect`
     * would be wrong AND we'd freeze it via `lastFramedModelRef`. Wait for the
     * real measure — the ResizeObserver re-runs this effect via the size deps.
     */
    if (!(size.width > 0) || !(size.height > 0)) return;

    // Make sure all matrices reflect the freshly-applied centering/scaling.
    modelGroup.updateMatrixWorld(true);
    const box = getWorldBoundingBox(modelGroup);
    if (!box) return;

    /* Same zoom as the slider / anatomy reset — otherwise FOV distance ≠ pose and the body "moves". */
    camera.zoom = zoomLevelToCameraZoom(zoomLevel);
    camera.updateProjectionMatrix();

    const fit = fitCameraToBoundingBox(
      box,
      camera,
      DEFAULT_BODY_FIT_PADDING,
      DEFAULT_BODY_FIT_ELEVATION,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only on model load / canvas resize
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

  /** Organ zoom: retry across several frames — meshes can arrive after `currentFocus` or `modelGroup`. */
  useEffect(() => {
    if (!currentFocus) {
      setZoomAnimation(null);
      return undefined;
    }
    // Organ focus = the user takes control: stop auto-re-fitting on resize.
    userAdjustedRef.current = true;
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
        userAdjustedRef.current = true;
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
