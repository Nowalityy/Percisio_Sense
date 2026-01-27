import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function SegmentClickHandler({ onSegmentClick }) {
  const { camera, scene, gl } = useThree();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  useEffect(() => {
    const handleClick = (event) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const intersect of intersects) {
        if (intersect.object.isMesh && intersect.object.name) {
          const segmentName = intersect.object.name;
          if (segmentName && segmentName !== 'undefined') {
            onSegmentClick?.(segmentName);
            return;
          }
        }
      }
    };

    gl.domElement.addEventListener('click', handleClick);
    return () => {
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [camera, scene, gl, onSegmentClick]);

  return null;
}
