import { useRef, useEffect, Suspense, memo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SEGMENTS } from './medicalColors';
import { Segment } from './Segment';

/**
 * Main model container that handles all segments and their centering/scaling
 */
export const ScannerModel = memo(function ScannerModel({ rotation = { x: 0, y: 0, z: 0 }, isAutoSpinning, onProgress }) {
  const groupRef = useRef();
  const segmentsRef = useRef();
  const loadedSegmentsRef = useRef(new Set());
  const lastProgressRef = useRef(0);

  // Apply rotation via manual state + auto-spin
  useFrame((state, delta) => {
    if (groupRef.current) {
      if (isAutoSpinning) {
        groupRef.current.rotation.y += delta * 0.5;
      } else {
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rotation.x, 0.1);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation.y, 0.1);
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, rotation.z, 0.1);
      }
    }
  });

  const centerModel = () => {
    if (segmentsRef.current && groupRef.current) {
      try {
        // RESET position before calculating box to avoid compounded offsets
        segmentsRef.current.position.set(0, 0, 0);
        
        const box = new THREE.Box3().setFromObject(segmentsRef.current);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        console.log(`[ScannerModel] Bounding Box: size=(${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)}), center=(${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)})`);

        if (size.x === 0 && size.y === 0 && size.z === 0) {
          console.warn('[ScannerModel] Empty bounding box, skipping centering');
          return;
        }

        const maxDimension = Math.max(size.x, size.y, size.z);
        if (maxDimension === 0) return;
        
        let scale = 2 / maxDimension; 
        groupRef.current.scale.set(scale, scale, scale);

        // APPLY offset
        segmentsRef.current.position.set(-center.x, -center.y, -center.z);
        
        console.log(`[ScannerModel] Centered: scale=${scale.toFixed(4)}`);
      } catch (err) {
        console.error('❌ Error centering model segments:', err);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(centerModel, 1000);
    const timer2 = setTimeout(centerModel, 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, []);

  const onSegmentLoaded = useCallback((name) => {
    if (loadedSegmentsRef.current.has(name)) return;
    loadedSegmentsRef.current.add(name);
    
    // Total segments only (no GLB model)
    const totalItems = SEGMENTS.length;
    
    // Throttle progress updates to avoid flickering via excessive re-renders
    const currentCount = loadedSegmentsRef.current.size;
    if (onProgress && (currentCount - lastProgressRef.current >= 3 || currentCount === totalItems)) {
      lastProgressRef.current = currentCount;
      onProgress(currentCount, totalItems);
    }
    
    // Only center every 10 segments or when finished to save CPU
    if (currentCount % 10 === 0 || currentCount === totalItems) {
      centerModel();
    }
  }, [onProgress]);

  return (
    <group ref={groupRef}>
      <group ref={segmentsRef}>
        {/* Segments OBJ uniquement */}
        {SEGMENTS.map((name) => (
          <Suspense key={name} fallback={null}>
            <Segment name={name} onLoad={onSegmentLoaded} />
          </Suspense>
        ))}
      </group>
    </group>
  );
});
