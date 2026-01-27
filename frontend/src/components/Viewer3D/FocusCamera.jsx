import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSceneStore } from '../../store';

const CAMERA_CONFIG = {
  TRANSITION_SPEED: 0.05,
  TARGET_LERP_SPEED: 0.08,
  DISTANCE_THRESHOLD: 0.1,
  ZOOM_DISTANCE_MULTIPLIER: 1.5,
  CAMERA_OFFSET: { x: 0.3, y: 0.4, z: 1.0 },
  MIN_DISTANCE: 0.5,
};

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

function calculateModelCenter(scene) {
  const box = new THREE.Box3();
  let hasObjects = false;

  scene.traverse((child) => {
    if (child.isMesh && child.visible) {
      box.expandByObject(child);
      hasObjects = true;
    }
  });

  if (!hasObjects) {
    return new THREE.Vector3(0, 0.8, 0);
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const torsoCenterY = center.y + size.y * TORSO_CENTER_OFFSET;

  return new THREE.Vector3(center.x, torsoCenterY, center.z);
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

function calculateCameraPosition(center, size) {
  const maxDimension = Math.max(size.x, size.y, size.z);
  const distance = Math.max(maxDimension * CAMERA_CONFIG.ZOOM_DISTANCE_MULTIPLIER, CAMERA_CONFIG.MIN_DISTANCE);

  return center.clone().add(
    new THREE.Vector3(
      distance * CAMERA_CONFIG.CAMERA_OFFSET.x,
      distance * CAMERA_CONFIG.CAMERA_OFFSET.y,
      distance * CAMERA_CONFIG.CAMERA_OFFSET.z
    )
  );
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

  useEffect(() => {
    const calculateCenter = () => {
      const center = calculateModelCenter(scene);
      setModelCenter(center);
    };

    const timers = MODEL_CENTER_CALCULATION_DELAYS.map((delay) => setTimeout(calculateCenter, delay));

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [scene]);

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
      return;
    }

    const cameraPos = calculateCameraPosition(center, size);
    setTargetFocus({ center, cameraPos });
    setIsTransitioning(true);
    wasFocusingRef.current = true;
  }, [currentFocus, scene, modelCenter]);

  useFrame(() => {
    if (!controlsRef.current) {
      return;
    }

    if (!currentFocus && !isInteracting) {
      const currentTarget = controlsRef.current.target;
      if (currentTarget.distanceTo(modelCenter) > TARGET_SNAP_DISTANCE) {
        controlsRef.current.target.lerp(modelCenter, CENTER_LERP_SPEED);
        controlsRef.current.update();
      }
      return;
    }

    if (isTransitioning && targetFocus && !isInteracting && currentFocus) {
      camera.position.lerp(targetFocus.cameraPos, CAMERA_CONFIG.TRANSITION_SPEED);
      controlsRef.current.target.lerp(targetFocus.center, CAMERA_CONFIG.TARGET_LERP_SPEED);
      controlsRef.current.update();

      if (camera.position.distanceTo(targetFocus.cameraPos) < CAMERA_CONFIG.DISTANCE_THRESHOLD) {
        setIsTransitioning(false);
      }
      return;
    }

    if (!currentFocus && wasFocusingRef.current) {
      wasFocusingRef.current = false;
      setIsTransitioning(false);
      setTargetFocus(null);
      controlsRef.current.target.lerp(modelCenter, 0.1);
      controlsRef.current.update();
      return;
    }

    controlsRef.current.update();
  });

  const handleInteractionStart = () => {
    setIsInteracting(true);
    setIsTransitioning(false);
  };

  const handleInteractionEnd = () => {
    setIsInteracting(false);
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
      minDistance={0.1}
      maxDistance={1000}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      autoRotate={false}
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
      makeDefault
    />
  );
}
