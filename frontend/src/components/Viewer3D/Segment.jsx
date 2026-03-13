import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useLoader, useThree } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { getSegmentColor, SEGMENTS } from './medicalColors';
import { useSceneStore } from '../../store';
import { isInFrustum } from '../../utils/performanceUtils';
import { isSegmentInFocus, getSegmentNamesForFocus } from './focusUtils';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const BONE_KEYWORDS = ['clavicle', 'scapula', 'sternum', 'humerus', 'spinal-cord'];
const SKIN_SEGMENT_NAME = 'segment_1';
const DIMMED_COLOR = '#94a3b8';
const DIMMED_OPACITY = 0.2;
const SKIN_OPACITY = 0.15;

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
    opacity: SKIN_OPACITY,
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

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function isBone(segmentName) {
  return BONE_KEYWORDS.some((keyword) => segmentName.includes(keyword));
}

function getRenderOrder(segmentName, segmentIndex) {
  if (segmentName === SKIN_SEGMENT_NAME) return RENDER_ORDER.SKIN;
  let order = segmentIndex >= 0 ? segmentIndex + RENDER_ORDER.BASE : RENDER_ORDER.BASE;
  if (isBone(segmentName)) order += RENDER_ORDER.BONE_OFFSET;
  return order;
}

function getDefaultOpacity(segmentName) {
  return segmentName === SKIN_SEGMENT_NAME ? SKIN_OPACITY : 1;
}

function getDefaultTransparent(segmentName) {
  return segmentName === SKIN_SEGMENT_NAME;
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
    const mat = new THREE.MeshStandardMaterial({
      ...MATERIAL_CONFIG.DEFAULT,
      ...MATERIAL_CONFIG.BONE,
    });
    mat.color.set('#ffffff');
    mat.emissive.set('#ffffff');
    return mat;
  }
  const emissiveColor = new THREE.Color(color).multiplyScalar(0.2);
  return new THREE.MeshStandardMaterial({
    ...MATERIAL_CONFIG.DEFAULT,
    ...MATERIAL_CONFIG.ORGAN,
    color,
    emissive: emissiveColor,
  });
}

function configureMesh(mesh, segmentName, color) {
  mesh.name = segmentName;
  mesh.visible = true;
  mesh.renderOrder = getRenderOrder(segmentName, SEGMENTS.indexOf(segmentName));
  mesh.material = createMaterial(segmentName, color);
}

function applyFocusStateToMesh(mesh, segmentName, isDimmed) {
  if (!mesh.material) return;
  const mat = mesh.material;
  if (isDimmed) {
    mat.color.set(DIMMED_COLOR);
    mat.opacity = DIMMED_OPACITY;
    mat.transparent = true;
    mat.depthWrite = false;
  } else {
    mat.color.set(getSegmentColor(segmentName));
    mat.opacity = getDefaultOpacity(segmentName);
    mat.transparent = getDefaultTransparent(segmentName);
    mat.depthWrite = segmentName !== SKIN_SEGMENT_NAME;
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Segment({ name, onLoad }) {
  const materials = useLoader(MTLLoader, `/models/segments/${name}.mtl`);
  const obj = useLoader(OBJLoader, `/models/segments/${name}.obj`, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });
  const { camera } = useThree();
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const currentFocus = useSceneStore((s) => s.currentFocus);

  const isUserVisible = useMemo(
    () => segmentVisibility.get(name) !== false,
    [name, segmentVisibility]
  );

  const isInView = useMemo(() => {
    if (!obj) return true;
    return isInFrustum(obj, camera);
  }, [obj, camera]);

  const isFocused = useMemo(
    () => (currentFocus ? isSegmentInFocus(name, currentFocus) : false),
    [name, currentFocus]
  );
  const hasValidFocus = useMemo(
    () => (currentFocus ? getSegmentNamesForFocus(currentFocus).length > 0 : false),
    [currentFocus]
  );
  const isDimmed = Boolean(hasValidFocus && !isFocused);

  useEffect(() => {
    if (!obj) return;
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
    if (!obj) return;
    obj.traverse((child) => {
      if (child.isMesh) child.visible = isUserVisible && isInView;
    });
  }, [obj, isUserVisible, isInView]);

  useEffect(() => {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.isMesh) applyFocusStateToMesh(child, name, isDimmed);
    });
  }, [obj, name, isDimmed]);

  if (!isUserVisible) return null;
  return <primitive object={obj} />;
}
