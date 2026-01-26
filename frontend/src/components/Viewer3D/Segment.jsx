import { useEffect } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { getSegmentColor, SEGMENTS } from './medicalColors';

/**
 * Component to load an individual segment (MTL + OBJ)
 */
export function Segment({ name, onLoad }) {
  const materials = useLoader(MTLLoader, `/models/segments/${name}.mtl`);
  const obj = useLoader(OBJLoader, `/models/segments/${name}.obj`, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  useEffect(() => {
    if (obj) {
      console.log(`[Segment] Loaded ${name}`);
      const color = getSegmentColor(name);
      
      obj.traverse((child) => {
        if (child.isMesh) {
          child.name = name;
          child.visible = true;
          
          const segmentIndex = SEGMENTS.indexOf(name);
          let baseOrder = segmentIndex > -1 ? segmentIndex + 10 : 10;
          
          const isBone = name.includes('clavicle') || name.includes('scapula') || name.includes('sternum') || name.includes('humerus') || name.includes('spinal-cord');
          if (isBone) baseOrder += 100;
          
          if (name === 'segment_1') baseOrder = 200;
          
          child.renderOrder = baseOrder;

          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
              // Convertir en MeshStandardMaterial pour un meilleur rendu des couleurs
              const newMaterial = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.6,
                metalness: 0.1,
                side: THREE.DoubleSide,
              });
              
              if (name === 'segment_1') {
                // Enveloppe/peau - transparente mais visible
                newMaterial.transparent = true;
                newMaterial.opacity = 0.15; // Légèrement plus visible
                newMaterial.depthWrite = false;
                newMaterial.side = THREE.FrontSide;
                newMaterial.roughness = 0.8;
              } else if (isBone) {
                // Os - blanc brillant
                newMaterial.color.set('#ffffff');
                newMaterial.roughness = 0.3;
                newMaterial.metalness = 0.2;
                newMaterial.emissive.set('#ffffff');
                newMaterial.emissiveIntensity = 0.1;
              } else {
                // Organes - couleurs vives et saturées
                newMaterial.transparent = false;
                newMaterial.opacity = 1.0;
                newMaterial.depthWrite = true;
                newMaterial.depthTest = true;
                newMaterial.roughness = 0.5;
                newMaterial.metalness = 0.05;
                
                // Ajouter une légère émission pour rendre les couleurs plus vives
                const emissiveColor = new THREE.Color(color);
                emissiveColor.multiplyScalar(0.2);
                newMaterial.emissive.copy(emissiveColor);
                newMaterial.emissiveIntensity = 0.3;
                
                m.polygonOffset = true;
                m.polygonOffsetFactor = isBone ? -2 : 1;
                m.polygonOffsetUnits = isBone ? -2 : 1;
              }
              
              // Remplacer le matériau
              child.material = newMaterial;
            });
            console.log(`[Segment] Updated materials for ${name} (color: ${color}, order: ${baseOrder})`);
          } else {
            // Créer un matériau si aucun n'existe
            const color = getSegmentColor(name);
            const newMaterial = new THREE.MeshStandardMaterial({
              color: color,
              roughness: 0.6,
              metalness: 0.1,
              side: THREE.DoubleSide,
            });
            child.material = newMaterial;
            console.log(`[Segment] Created new material for ${name} (color: ${color})`);
          }
        }
      });
      
      if (onLoad) onLoad(name);
    }
  }, [name, obj, onLoad]);

  return <primitive object={obj} />;
}
