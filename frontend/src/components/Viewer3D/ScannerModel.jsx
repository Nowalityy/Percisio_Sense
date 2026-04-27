import { useRef, Suspense, memo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Segment } from './Segment';
import { useDispose } from '../../hooks/useDispose';
import { applyModelRotation, centerModelInGroup } from '../../viewer-core/modelCore';
import { useSceneStore } from '../../store';
import { getSegmentListForSet } from '../../segmentList';

export const ScannerModel = memo(function ScannerModel({
  rotation = { x: 0, y: 0, z: 0 },
  isAutoSpinning,
  onProgress,
}) {
  const anatomySegmentSet = useSceneStore((s) => s.anatomySegmentSet);
  const setModelGroup = useSceneStore((s) => s.setModelGroup);
  const segmentNames = getSegmentListForSet(anatomySegmentSet);
  const { invalidate } = useThree();
  const groupRef = useRef();
  const segmentsRef = useRef();
  const loadedSegmentsRef = useRef(new Set());

  useDispose(
    () => [segmentsRef.current, groupRef.current],
    []
  );

  // Clear the published model group when this instance unmounts (e.g., DICOM
  // switch via the `key={anatomySegmentSet}` on ScannerModel) so consumers
  // (FocusCamera) know the previous model is gone before the new one finishes
  // loading.
  useEffect(() => {
    return () => setModelGroup(null);
  }, [setModelGroup]);

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
      const totalItems = segmentNames.length;

      if (onProgress) {
        onProgress(currentCount, totalItems);
      }

      if (currentCount === totalItems) {
        centerModelInGroup(segmentsRef.current, groupRef.current);
        // Publish the centered & scaled root group so FocusCamera can fit
        // the camera to the actual world-space bounding box of the model
        // (instead of using hardcoded coordinates per anatomy set).
        setModelGroup(groupRef.current);
        invalidate();
      }
    },
    [onProgress, segmentNames.length, invalidate, setModelGroup]
  );

  return (
    <group ref={groupRef}>
      <group ref={segmentsRef}>
        {segmentNames.map((name, index) => (
          <Suspense key={name} fallback={null}>
            <Segment name={name} orderIndex={index} onLoad={onSegmentLoaded} />
          </Suspense>
        ))}
      </group>
    </group>
  );
});
