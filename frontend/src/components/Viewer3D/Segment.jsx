import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useLoader, useThree } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { getSegmentColor, isSkinSegment } from './medicalColors';
import { useSceneStore } from '../../store';
import { getFocusSegmentSet } from './focusUtils';
import { segmentAbsoluteUrl } from '../../config/segmentAssets';

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
const DIMMED_COLOR = '#94a3b8';
const DIMMED_OPACITY = 0.2;
const SKIN_DEFAULT_OPACITY = 0.15;

const RENDER_ORDER = {
  BASE: 10,
  BONE_OFFSET: 100,
  SKIN: 200,
};

const _emissiveScratch = new THREE.Color();

const MATERIAL_CONFIG = {
  DEFAULT: {
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.DoubleSide,
  },
  SKIN: {
    transparent: true,
    opacity: SKIN_DEFAULT_OPACITY,
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
  if (isSkinSegment(segmentName)) return RENDER_ORDER.SKIN;
  let order = segmentIndex >= 0 ? segmentIndex + RENDER_ORDER.BASE : RENDER_ORDER.BASE;
  if (isBone(segmentName)) order += RENDER_ORDER.BONE_OFFSET;
  return order;
}

function getDefaultOpacity(segmentName, skinOpacity) {
  return isSkinSegment(segmentName) ? skinOpacity : 1;
}

function getDefaultTransparent(segmentName) {
  return isSkinSegment(segmentName);
}

function createMaterial(segmentName, color, skinOpacity) {
  if (isSkinSegment(segmentName)) {
    return new THREE.MeshStandardMaterial({
      ...MATERIAL_CONFIG.DEFAULT,
      ...MATERIAL_CONFIG.SKIN,
      opacity: skinOpacity,
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

function configureMesh(mesh, segmentName, color, orderIndex, skinOpacity) {
  mesh.name = segmentName;
  mesh.userData.segmentId = segmentName;
  mesh.visible = true;
  mesh.renderOrder = getRenderOrder(segmentName, orderIndex);
  mesh.material = createMaterial(segmentName, color, skinOpacity);
}

function applyFocusStateToMesh(mesh, segmentName, isDimmed, skinOpacity) {
  if (!mesh.material) return;
  const mat = mesh.material;
  if (isDimmed) {
    mat.color.set(DIMMED_COLOR);
    mat.opacity = DIMMED_OPACITY;
    mat.transparent = true;
    mat.depthWrite = false;
    if (mat.emissive) {
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
    }
  } else {
    mat.color.set(getSegmentColor(segmentName));
    mat.opacity = getDefaultOpacity(segmentName, skinOpacity);
    mat.transparent = getDefaultTransparent(segmentName);
    mat.depthWrite = !isSkinSegment(segmentName);
    if (mat.emissive) {
      if (isBone(segmentName)) {
        mat.emissive.set('#ffffff');
        mat.emissiveIntensity = 0.1;
      } else {
        _emissiveScratch.set(getSegmentColor(segmentName)).multiplyScalar(0.2);
        mat.emissive.copy(_emissiveScratch);
        mat.emissiveIntensity = 0.3;
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Segment({ name, orderIndex = -1, onLoad }) {
  const anatomySegmentSet = useSceneStore((s) => s.anatomySegmentSet);
  const materials = useLoader(MTLLoader, segmentAbsoluteUrl(name, '.mtl', anatomySegmentSet));
  const obj = useLoader(OBJLoader, segmentAbsoluteUrl(name, '.obj', anatomySegmentSet), (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });
  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const skinOpacity = useSceneStore((s) => s.skinOpacity);
  const segmentObject = useMemo(() => obj.clone(true), [obj]);
  // Canvas runs in `frameloop="demand"` (see ViewerCanvas) — three.js only
  // redraws after `invalidate()`. Mutating mat.opacity in a useEffect does
  // not trigger a re-render on its own, so we explicitly invalidate.
  const invalidate = useThree((state) => state.invalidate);

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
        configureMesh(child, name, color, orderIndex, skinOpacity);
        child.visible = isUserVisible;
      }
    });
    onLoad?.(name);
    invalidate();
    // skinOpacity intentionally omitted: handled by the dedicated effect below
    // so material instances aren't recreated on every slider tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, orderIndex, segmentObject, onLoad, isUserVisible, invalidate]);

  // Mount/unmount of the <primitive> below changes the scene graph without
  // triggering a frame in `frameloop="demand"`. We must invalidate whenever
  // visibility flips so toggling a segment off/on actually updates the canvas.
  useEffect(() => {
    if (!segmentObject) return;
    segmentObject.traverse((child) => {
      if (child.isMesh) child.visible = isUserVisible;
    });
    invalidate();
  }, [segmentObject, isUserVisible, invalidate]);

  useEffect(() => {
    if (!segmentObject) return;
    segmentObject.traverse((child) => {
      if (child.isMesh) applyFocusStateToMesh(child, name, isDimmed, skinOpacity);
    });
    invalidate();
  }, [segmentObject, name, isDimmed, skinOpacity, invalidate]);

  // Stay mounted even when filtered off so `centerModelInGroup` can measure the full body
  // (`Box3` ignores invisible meshes unless we temporarily force-visible there).
  return <primitive object={segmentObject} />;
}
