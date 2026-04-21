import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { getSegmentColor, SEGMENTS } from './medicalColors';
import { useSceneStore } from '../../store';
import { getFocusSegmentSet } from './focusUtils';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const BONE_KEYWORDS = [
  'clavicle',
  'scapula',
  'sternum',
  'humerus',
  'spinal cord',
  'spinal-cord',
  'rib',
  'vertebra',
  'sacrum',
  'femur',
  'cartilage',
];
const SKIN_SEGMENT_NAME = 'segment_1';
const DIMMED_COLOR = '#94a3b8';
const DIMMED_OPACITY = 0.2;
const SKIN_OPACITY = 0.15;

const RENDER_ORDER = {
  BASE: 10,
  BONE_OFFSET: 100,
  SKIN: 200,
};
const SEGMENT_INDEX_BY_NAME = new Map(
  SEGMENTS.map((segmentName, index) => [segmentName, index])
);

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
  const s = segmentName.toLowerCase();
  return BONE_KEYWORDS.some((keyword) => s.includes(keyword.toLowerCase()));
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
  mesh.renderOrder = getRenderOrder(
    segmentName,
    SEGMENT_INDEX_BY_NAME.get(segmentName) ?? -1
  );
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

function segmentUrl(name, ext) {
  return `/models/segments/${encodeURIComponent(name)}${ext}`;
}

export function Segment({ name, onLoad }) {
  const materials = useLoader(MTLLoader, segmentUrl(name, '.mtl'));
  const obj = useLoader(OBJLoader, segmentUrl(name, '.obj'), (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const segmentObject = useMemo(() => obj.clone(true), [obj]);

  const isUserVisible = useMemo(
    () => segmentVisibility.get(name) !== false,
    [name, segmentVisibility]
  );

  const focusSegmentSet = useMemo(
    () => (currentFocus ? getFocusSegmentSet(currentFocus) : new Set()),
    [currentFocus]
  );
  const isFocused = focusSegmentSet.has(name);
  const hasValidFocus = focusSegmentSet.size > 0;
  const isDimmed = Boolean(hasValidFocus && !isFocused);

  useEffect(() => {
    if (!segmentObject) return;
    const color = getSegmentColor(name);
    segmentObject.traverse((child) => {
      if (child.isMesh) {
        // PERF: Ensure meshes outside camera frustum are skipped by GPU.
        child.frustumCulled = true;
        configureMesh(child, name, color);
        child.visible = isUserVisible;
      }
    });
    onLoad?.(name);
  }, [name, segmentObject, onLoad, isUserVisible]);

  useEffect(() => {
    if (!segmentObject) return;
    segmentObject.traverse((child) => {
      if (child.isMesh) child.visible = isUserVisible;
    });
  }, [segmentObject, isUserVisible]);

  useEffect(() => {
    if (!segmentObject) return;
    segmentObject.traverse((child) => {
      if (child.isMesh) applyFocusStateToMesh(child, name, isDimmed);
    });
  }, [segmentObject, name, isDimmed]);

  if (!isUserVisible) return null;
  return <primitive object={segmentObject} />;
}
