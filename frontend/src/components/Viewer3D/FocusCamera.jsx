import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSceneStore } from '../../store';
import { serializeCameraStateFromScene } from '../../utils/cameraStateUtils.js';

const CAMERA_CONFIG = {
  FOCUS_TRANSITION_DURATION_MS: 500,
  HISTORY_RESTORE_DURATION_MS: 500,
  DISTANCE_THRESHOLD: 0.05,
  FRAME_PADDING: 1.2,
  MIN_DISTANCE: 0.5,
  MAX_DISTANCE: 150,
  MIN_POLAR_ANGLE: 0.1,
  MAX_POLAR_ANGLE: Math.PI - 0.1,
};

/** Ease-in-out cubic for smooth start/end. */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const TORSO_CENTER_OFFSET = 0.15;
const MODEL_CENTER_CALCULATION_DELAYS = [2000, 5000];
const TARGET_SNAP_DISTANCE = 0.01;
const CENTER_LERP_SPEED = 0.05;

const CATEGORY_MATCHES = {
  lung: ['lung'],
  clavicle: ['clavicle'],
  scapula: ['scapula'],
  humerus: ['humerus'],
  artery: ['artery'],
  vein: ['vein'],
  muscle: ['muscle'],
  pulmonary: ['pulmonary'],
  spinal: ['spinal-cord'],
  adrenal: ['adrenal'],
};

function computeModelBounds(scene) {
  const box = new THREE.Box3();
  let hasObjects = false;
  scene.traverse((child) => {
    if (child.isMesh && child.visible) {
      box.expandByObject(child);
      hasObjects = true;
    }
  });
  if (!hasObjects) {
    return { center: new THREE.Vector3(0, 0.8, 0), size: new THREE.Vector3(2, 2, 2) };
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const torsoCenterY = center.y + size.y * TORSO_CENTER_OFFSET;
  return {
    center: new THREE.Vector3(center.x, torsoCenterY, center.z),
    size,
  };
}

function findMatchingObjects(scene, focusName) {
  const foundObjects = [];
  const focusLower = focusName.toLowerCase();

  scene.traverse((child) => {
    if (!child.isMesh || !child.name) {
      return;
    }

    const childNameLower = child.name.toLowerCase();

    if (childNameLower === focusLower) {
      foundObjects.push(child);
      return;
    }

    if (matchesCategory(childNameLower, focusLower)) {
      foundObjects.push(child);
      return;
    }

    if (matchesPartial(childNameLower, focusLower)) {
      foundObjects.push(child);
    }
  });

  return foundObjects;
}

function matchesCategory(childName, focusName) {
  const category = CATEGORY_MATCHES[focusName];
  if (!category) {
    return false;
  }

  return category.some((keyword) => childName.includes(keyword));
}

function matchesPartial(childName, focusName) {
  if (!childName.includes(focusName) && !focusName.includes(childName)) {
    return false;
  }

  return (
    childName.startsWith(focusName) ||
    childName.endsWith(focusName) ||
    childName.includes(`-${focusName}-`) ||
    childName.includes(`-${focusName}`) ||
    childName.includes(`${focusName}-`)
  );
}

function calculateBoundingBox(objects) {
  const box = new THREE.Box3();

  objects.forEach((obj) => {
    if (obj.visible && obj.geometry) {
      box.expandByObject(obj);
    }
  });

  return box;
}

/**
 * Compute camera position so the bounding box fits in the frustum with padding.
 * Uses camera fov and aspect to get required distance (vertical and horizontal), takes max + padding.
 */
function calculateCameraPositionFramed(center, size, camera) {
  const box = new THREE.Box3(
    center.clone().sub(size.clone().multiplyScalar(0.5)),
    center.clone().add(size.clone().multiplyScalar(0.5))
  );
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const radius = sphere.radius;
  if (radius <= 0) {
    const fallbackDist = Math.max(size.x, size.y, size.z) * 1.5;
    return center.clone().add(new THREE.Vector3(0, 0, Math.max(fallbackDist, CAMERA_CONFIG.MIN_DISTANCE)));
  }
  const fovRad = (camera.fov * Math.PI) / 180;
  const aspect = camera.aspect;
  const distanceV = radius / Math.tan(fovRad / 2);
  const distanceH = radius / Math.tan(Math.atan(Math.tan(fovRad / 2) * aspect));
  const distance = Math.max(distanceV, distanceH) * CAMERA_CONFIG.FRAME_PADDING;
  const d = Math.max(distance, CAMERA_CONFIG.MIN_DISTANCE);
  const dir = new THREE.Vector3(0.3, 0.4, 1).normalize();
  return center.clone().add(dir.multiplyScalar(d));
}

export function FocusCamera() {
  const controlsRef = useRef();
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const wasFocusingRef = useRef(false);
  const { scene, camera } = useThree();

  const [targetFocus, setTargetFocus] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [modelCenter, setModelCenter] = useState(new THREE.Vector3(0, 0.8, 0));
  const [cameraLimits, setCameraLimits] = useState({
    minDistance: CAMERA_CONFIG.MIN_DISTANCE,
    maxDistance: CAMERA_CONFIG.MAX_DISTANCE,
  });
  const modelBoundsRef = useRef({ size: new THREE.Vector3(2, 2, 2) });
  const focusTransitionStartRef = useRef(0);
  const focusTransitionStartPosRef = useRef(null);
  const focusTransitionStartTargetRef = useRef(null);
  const restoreAnimationRef = useRef({ startTime: 0, from: null, to: null });

  const pendingCameraRestore = useSceneStore((s) => s.pendingCameraRestore);
  const setGetCameraState = useSceneStore((s) => s.setGetCameraState);
  const setPendingCameraRestore = useSceneStore((s) => s.setPendingCameraRestore);

  useEffect(() => {
    const updateBounds = () => {
      const { center, size } = computeModelBounds(scene);
      setModelCenter(center);
      modelBoundsRef.current = { center, size };
      const maxDim = Math.max(size.x, size.y, size.z) || 2;
      setCameraLimits({
        minDistance: Math.max(CAMERA_CONFIG.MIN_DISTANCE, maxDim * 0.15),
        maxDistance: Math.max(CAMERA_CONFIG.MAX_DISTANCE, maxDim * 3),
      });
    };
    const timers = MODEL_CENTER_CALCULATION_DELAYS.map((delay) => setTimeout(updateBounds, delay));
    updateBounds();
    return () => timers.forEach((t) => clearTimeout(t));
  }, [scene]);

  useEffect(() => {
    const getCameraState = () => {
      if (!controlsRef.current || !camera) return null;
      return serializeCameraStateFromScene(camera, controlsRef.current.target);
    };
    setGetCameraState(() => getCameraState);
    return () => setGetCameraState(null);
  }, [camera, setGetCameraState]);

  useEffect(() => {
    if (!currentFocus) {
      if (wasFocusingRef.current) {
        wasFocusingRef.current = false;
        setIsTransitioning(false);
        setTargetFocus(null);
      }
      return;
    }

    const foundObjects = findMatchingObjects(scene, currentFocus);

    if (foundObjects.length === 0) {
      setIsTransitioning(false);
      setTargetFocus(null);
      return;
    }

    const boundingBox = calculateBoundingBox(foundObjects);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    if (size.x === 0 && size.y === 0 && size.z === 0) {
      const fallbackPosition = modelCenter.clone().add(new THREE.Vector3(0, 0, 5));
      setTargetFocus({ center: modelCenter, cameraPos: fallbackPosition });
      setIsTransitioning(true);
      wasFocusingRef.current = true;
      focusTransitionStartRef.current = performance.now();
      focusTransitionStartPosRef.current = camera.position.clone();
      focusTransitionStartTargetRef.current = controlsRef.current?.target?.clone() ?? modelCenter.clone();
      return;
    }

    const cameraPos = calculateCameraPositionFramed(center, size, camera);
    setTargetFocus({ center, cameraPos });
    setIsTransitioning(true);
    wasFocusingRef.current = true;
    focusTransitionStartRef.current = performance.now();
    focusTransitionStartPosRef.current = camera.position.clone();
    focusTransitionStartTargetRef.current = controlsRef.current?.target?.clone() ?? modelCenter.clone();
  }, [currentFocus, scene, modelCenter, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (pendingCameraRestore && !restoreAnimationRef.current.to) {
      const from = serializeCameraStateFromScene(camera, controls.target);
      if (from) {
        restoreAnimationRef.current = {
          startTime: performance.now(),
          from,
          to: pendingCameraRestore,
        };
        setPendingCameraRestore(null);
      }
    }

    const restore = restoreAnimationRef.current;
    if (restore && restore.from && restore.to) {
      const elapsed = performance.now() - restore.startTime;
      const t = Math.min(elapsed / CAMERA_CONFIG.HISTORY_RESTORE_DURATION_MS, 1);
      const eased = easeInOutCubic(t);
      const fromP = restore.from.position;
      const toP = restore.to.position;
      const fromT = restore.from.target;
      const toT = restore.to.target;
      camera.position.set(
        THREE.MathUtils.lerp(fromP.x, toP.x, eased),
        THREE.MathUtils.lerp(fromP.y, toP.y, eased),
        THREE.MathUtils.lerp(fromP.z, toP.z, eased)
      );
      controls.target.set(
        THREE.MathUtils.lerp(fromT.x, toT.x, eased),
        THREE.MathUtils.lerp(fromT.y, toT.y, eased),
        THREE.MathUtils.lerp(fromT.z, toT.z, eased)
      );
      // R3F/Three.js camera is mutated in useFrame by design for restore animation
      /* eslint-disable react-hooks/immutability */
      if (restore.to.zoom != null) camera.zoom = THREE.MathUtils.lerp(restore.from.zoom, restore.to.zoom, eased);
      if (restore.to.fov != null) camera.fov = THREE.MathUtils.lerp(restore.from.fov, restore.to.fov, eased);
      /* eslint-enable react-hooks/immutability */
      camera.updateProjectionMatrix();
      controls.update();
      if (t >= 1) restoreAnimationRef.current = { startTime: 0, from: null, to: null };
      return;
    }

    if (!currentFocus && !isInteracting) {
      if (controls.target.distanceTo(modelCenter) > TARGET_SNAP_DISTANCE) {
        controls.target.lerp(modelCenter, CENTER_LERP_SPEED);
        controls.update();
      }
      return;
    }

    if (isTransitioning && targetFocus && !isInteracting && currentFocus) {
      const startPos = focusTransitionStartPosRef.current;
      const startTarget = focusTransitionStartTargetRef.current;
      const elapsed = performance.now() - focusTransitionStartRef.current;
      const t = Math.min(elapsed / CAMERA_CONFIG.FOCUS_TRANSITION_DURATION_MS, 1);
      const eased = easeInOutCubic(t);
      if (startPos && startTarget) {
        camera.position.lerpVectors(startPos, targetFocus.cameraPos, eased);
        controls.target.lerpVectors(startTarget, targetFocus.center, eased);
      } else {
        camera.position.lerp(targetFocus.cameraPos, eased);
        controls.target.lerp(targetFocus.center, eased);
      }
      controls.update();
      if (t >= 1 || camera.position.distanceTo(targetFocus.cameraPos) < CAMERA_CONFIG.DISTANCE_THRESHOLD) {
        setIsTransitioning(false);
      }
      return;
    }

    if (!currentFocus && wasFocusingRef.current) {
      wasFocusingRef.current = false;
      setIsTransitioning(false);
      setTargetFocus(null);
      controls.target.lerp(modelCenter, 0.1);
      controls.update();
      return;
    }

    controls.update();
  });

  const handleInteractionStart = () => {
    setIsInteracting(true);
    setIsTransitioning(false);
  };

  const handleInteractionEnd = () => {
    setIsInteracting(false);
    useSceneStore.getState().requestHistoryPush?.();
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableDamping
      enableZoom
      enableRotate
      dampingFactor={0.1}
      rotateSpeed={1.0}
      zoomSpeed={1.2}
      panSpeed={1.0}
      minDistance={cameraLimits.minDistance}
      maxDistance={cameraLimits.maxDistance}
      minPolarAngle={CAMERA_CONFIG.MIN_POLAR_ANGLE}
      maxPolarAngle={CAMERA_CONFIG.MAX_POLAR_ANGLE}
      autoRotate={false}
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
      makeDefault
    />
  );
}
