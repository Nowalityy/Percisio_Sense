import { useRef, useEffect, Suspense, memo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SEGMENTS } from './medicalColors';
import { Segment } from './Segment';

const ROTATION_LERP_FACTOR = 0.1;
const AUTO_SPIN_SPEED = 0.5;
const SCALE_FACTOR = 2;
const PROGRESS_UPDATE_THROTTLE = 3;

function applyRotation(groupRef, rotation, isAutoSpinning, delta) {
  if (!groupRef.current) {
    return;
  }

  if (isAutoSpinning) {
    groupRef.current.rotation.y += delta * AUTO_SPIN_SPEED;
    return;
  }

  groupRef.current.rotation.x = THREE.MathUtils.lerp(
    groupRef.current.rotation.x,
    rotation.x,
    ROTATION_LERP_FACTOR
  );
  groupRef.current.rotation.y = THREE.MathUtils.lerp(
    groupRef.current.rotation.y,
    rotation.y,
    ROTATION_LERP_FACTOR
  );
  groupRef.current.rotation.z = THREE.MathUtils.lerp(
    groupRef.current.rotation.z,
    rotation.z,
    ROTATION_LERP_FACTOR
  );
}

function centerModel(segmentsRef, groupRef) {
  if (!segmentsRef.current || !groupRef.current) {
    return;
  }

  try {
    segmentsRef.current.position.set(0, 0, 0);

    const box = new THREE.Box3().setFromObject(segmentsRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    if (size.x === 0 && size.y === 0 && size.z === 0) {
      return;
    }

    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension === 0) {
      return;
    }

    const scale = SCALE_FACTOR / maxDimension;
    groupRef.current.scale.set(scale, scale, scale);
    segmentsRef.current.position.set(-center.x, -center.y, -center.z);
  } catch (err) {
    console.error('Error centering model segments:', err);
  }
}

export const ScannerModel = memo(function ScannerModel({
  rotation = { x: 0, y: 0, z: 0 },
  isAutoSpinning,
  onProgress,
}) {
  const groupRef = useRef();
  const segmentsRef = useRef();
  const loadedSegmentsRef = useRef(new Set());
  const lastProgressRef = useRef(0);

  useFrame((state, delta) => {
    applyRotation(groupRef, rotation, isAutoSpinning, delta);
  });

  const onSegmentLoaded = useCallback(
    (name) => {
      if (loadedSegmentsRef.current.has(name)) {
        return;
      }

      loadedSegmentsRef.current.add(name);
      const currentCount = loadedSegmentsRef.current.size;
      const totalItems = SEGMENTS.length;

      if (onProgress) {
        const shouldUpdate =
          currentCount - lastProgressRef.current >= PROGRESS_UPDATE_THROTTLE ||
          currentCount === totalItems;

        if (shouldUpdate) {
          lastProgressRef.current = currentCount;
          onProgress(currentCount, totalItems);
        }
      }

      // Center and scale the model only once when all segments are loaded (avoids zoom/dezoom on load)
      if (currentCount === totalItems) {
        centerModel(segmentsRef, groupRef);
      }
    },
    [onProgress]
  );

  return (
    <group ref={groupRef}>
      <group ref={segmentsRef}>
        {SEGMENTS.map((name) => (
          <Suspense key={name} fallback={null}>
            <Segment name={name} onLoad={onSegmentLoaded} />
          </Suspense>
        ))}
      </group>
    </group>
  );
});
