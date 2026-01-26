import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSceneStore } from '../../store';

/**
 * Camera controller that handles transitions and auto-orbiting for focused organs
 */
export function FocusCamera() {
  const controlsRef = useRef();
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const wasFocusingRef = useRef(false);
  const { scene, camera } = useThree();

  const [targetFocus, setTargetFocus] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (currentFocus) {
      const foundObjects = [];
      
      scene.traverse((child) => {
        if (child.name) {
          if (child.name === currentFocus || child.name.toLowerCase().includes(currentFocus.toLowerCase())) {
            foundObjects.push(child);
          }
        }
      });

      if (foundObjects.length > 0) {
        const combinedBox = new THREE.Box3();
        foundObjects.forEach((obj) => {
          combinedBox.expandByObject(obj);
        });
        
        const center = combinedBox.getCenter(new THREE.Vector3());
        const size = combinedBox.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        // Distance plus grande pour mieux voir l'organe
        const distance = maxDim * 1.2; 
        
        // Position caméra avec un angle légèrement surélevé pour une meilleure vue
        const cameraPos = center.clone().add(new THREE.Vector3(
          distance * 0.3, 
          distance * 0.4, 
          distance > 0.5 ? distance : 0.5
        ));
        
        setTargetFocus({ center, cameraPos });
        setIsTransitioning(true);
        wasFocusingRef.current = true;
      } else {
        setIsTransitioning(false);
        setTargetFocus(null);
      }
    } else if (wasFocusingRef.current) {
      // Quand le focus est annulé, ne pas forcer de transition - laisser l'utilisateur contrôler librement
      wasFocusingRef.current = false;
      setIsTransitioning(false);
      setTargetFocus(null);
    }
  }, [currentFocus, scene]);

  useFrame(() => {
    // Seulement forcer la transition si l'utilisateur n'interagit pas ET qu'un focus est actif
    if (isTransitioning && targetFocus && !isInteracting && currentFocus) {
      camera.position.lerp(targetFocus.cameraPos, 0.05); // Plus lent pour moins de contrainte
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetFocus.center, 0.08);
        controlsRef.current.update();
      }

      if (camera.position.distanceTo(targetFocus.cameraPos) < 0.1) {
        setIsTransitioning(false);
      }
    } else if (!currentFocus && wasFocusingRef.current) {
      // Quand le focus est annulé, libérer complètement la caméra
      wasFocusingRef.current = false;
      setIsTransitioning(false);
      setTargetFocus(null);
      if (controlsRef.current) {
        // Laisser l'utilisateur contrôler librement
        controlsRef.current.update();
      }
    } else if (!currentFocus) {
      // Pas de focus = contrôle totalement libre
      if (controlsRef.current) {
        controlsRef.current.update();
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableDamping={true}
      enableZoom={true}
      enableRotate={true}
      dampingFactor={0.1}
      rotateSpeed={1.0}
      zoomSpeed={1.2}
      panSpeed={1.0}
      minDistance={0.1}
      maxDistance={1000}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      autoRotate={false} // Désactivé pour plus de liberté
      onStart={() => {
        setIsInteracting(true);
        setIsTransitioning(false); // Arrêter toute transition quand l'utilisateur interagit
      }}
      onEnd={() => {
        setIsInteracting(false);
        // Ne pas reprendre la transition automatiquement - laisser l'utilisateur contrôler
      }}
      target={[0, 0, 0]}
      makeDefault // Permet un contrôle total
    />
  );
}
