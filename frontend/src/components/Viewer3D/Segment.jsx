import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useLoader, useThree } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { getSegmentColor, SEGMENTS } from './medicalColors';
import { useSceneStore } from '../../store';
import { isInFrustum } from '../../utils/performanceUtils';

const BONE_KEYWORDS = ['clavicle', 'scapula', 'sternum', 'humerus', 'spinal-cord'];
const SKIN_SEGMENT_NAME = 'segment_1';

const RENDER_ORDER = {
  BASE: 10,
  BONE_OFFSET: 100,
  SKIN: 200,
};

const MATERIAL_CONFIG = {
  DEFAULT: {
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.DoubleSide,
  },
  SKIN: {
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    side: THREE.FrontSide,
    roughness: 0.8,
  },
  BONE: {
    color: '#ffffff',
    roughness: 0.3,
    metalness: 0.2,
    emissive: '#ffffff',
    emissiveIntensity: 0.1,
  },
  ORGAN: {
    transparent: false,
    opacity: 1.0,
    depthWrite: true,
    depthTest: true,
    roughness: 0.5,
    metalness: 0.05,
    emissiveIntensity: 0.3,
  },
};

function isBone(segmentName) {
  return BONE_KEYWORDS.some((keyword) => segmentName.includes(keyword));
}

function calculateRenderOrder(segmentName, segmentIndex) {
  if (segmentName === SKIN_SEGMENT_NAME) {
    return RENDER_ORDER.SKIN;
  }

  let order = segmentIndex >= 0 ? segmentIndex + RENDER_ORDER.BASE : RENDER_ORDER.BASE;
  if (isBone(segmentName)) {
    order += RENDER_ORDER.BONE_OFFSET;
  }

  return order;
}

function createMaterial(segmentName, color) {
  if (segmentName === SKIN_SEGMENT_NAME) {
    return new THREE.MeshStandardMaterial({
      ...MATERIAL_CONFIG.DEFAULT,
      ...MATERIAL_CONFIG.SKIN,
      color,
    });
  }

  if (isBone(segmentName)) {
    const boneMaterial = new THREE.MeshStandardMaterial({
      ...MATERIAL_CONFIG.DEFAULT,
      ...MATERIAL_CONFIG.BONE,
    });
    // Force white color for bones
    boneMaterial.color.set('#ffffff');
    boneMaterial.emissive.set('#ffffff');
    return boneMaterial;
  }

  const emissiveColor = new THREE.Color(color);
  emissiveColor.multiplyScalar(0.2); // Emissive multiplier

  const material = new THREE.MeshStandardMaterial({
    ...MATERIAL_CONFIG.DEFAULT,
    ...MATERIAL_CONFIG.ORGAN,
    color,
    emissive: emissiveColor,
  });

  return material;
}

function applyMaterialToMesh(mesh, segmentName, color) {
  if (!mesh.material) {
    mesh.material = createMaterial(segmentName, color);
    return;
  }

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach(() => {
    mesh.material = createMaterial(segmentName, color);
  });
}

function configureMesh(mesh, segmentName, color) {
  mesh.name = segmentName;
  mesh.visible = true;

  const segmentIndex = SEGMENTS.indexOf(segmentName);
  mesh.renderOrder = calculateRenderOrder(segmentName, segmentIndex);

  applyMaterialToMesh(mesh, segmentName, color);
}

export function Segment({ name, onLoad }) {
  const materials = useLoader(MTLLoader, `/models/segments/${name}.mtl`);
  const obj = useLoader(OBJLoader, `/models/segments/${name}.obj`, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });
  const { camera } = useThree();
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);

  const isUserVisible = useMemo(() => {
    return segmentVisibility.get(name) !== false;
  }, [name, segmentVisibility]);

  const isInView = useMemo(() => {
    if (!obj) {
      return true;
    }
    return isInFrustum(obj, camera);
  }, [obj, camera]);

  useEffect(() => {
    if (!obj) {
      return;
    }

    const color = getSegmentColor(name);

    obj.traverse((child) => {
      if (child.isMesh) {
        configureMesh(child, name, color);
        child.visible = isUserVisible && isInView;
      }
    });

    onLoad?.(name);
  }, [name, obj, onLoad, isUserVisible, isInView]);

  useEffect(() => {
    if (!obj) {
      return;
    }

    obj.traverse((child) => {
      if (child.isMesh) {
        child.visible = isUserVisible && isInView;
      }
    });
  }, [obj, isUserVisible, isInView]);

  if (!isUserVisible) {
    return null;
  }

  return <primitive object={obj} />;
}
