import { useRef, Suspense, memo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SEGMENTS } from './medicalColors';
import { Segment } from './Segment';
import { useDispose } from '../../hooks/useDispose';
import { applyModelRotation, centerModelInGroup } from '../../viewer-core/modelCore';

export const ScannerModel = memo(function ScannerModel({
  rotation = { x: 0, y: 0, z: 0 },
  isAutoSpinning,
  onProgress,
}) {
  const { invalidate } = useThree();
  const groupRef = useRef();
  const segmentsRef = useRef();
  const loadedSegmentsRef = useRef(new Set());

  useDispose(
    () => [segmentsRef.current, groupRef.current],
    []
  );

  useFrame((state, delta) => {
    const changed = applyModelRotation(groupRef.current, rotation, isAutoSpinning, delta);
    if (changed) {
      // PERF: Keep demand-loop active while rotation is animating.
      invalidate();
    }
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
        onProgress(currentCount, totalItems);
      }

      // Center and scale the model only once when all segments are loaded (avoids zoom/dezoom on load)
      if (currentCount === totalItems) {
        centerModelInGroup(segmentsRef.current, groupRef.current);
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
