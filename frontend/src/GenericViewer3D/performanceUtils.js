import * as THREE from 'three';

const LOD_DISTANCE_THRESHOLDS = {
  HIGH: 5,
  MEDIUM: 15,
  LOW: 30,
};

export function shouldLoadSegment(distance, quality = 'high') {
  if (quality === 'low') {
    return distance < LOD_DISTANCE_THRESHOLDS.LOW;
  }
  if (quality === 'medium') {
    return distance < LOD_DISTANCE_THRESHOLDS.MEDIUM;
  }
  return distance < LOD_DISTANCE_THRESHOLDS.HIGH;
}

export function calculateDistanceToCamera(object, camera) {
  if (!object || !camera) {
    return Infinity;
  }

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  return camera.position.distanceTo(center);
}

export function isInFrustum(object, camera) {
  if (!object || !camera) {
    return false;
  }

  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(matrix);

  const box = new THREE.Box3().setFromObject(object);
  return frustum.intersectsBox(box);
}

/**
 * Stub: does not perform real geometry simplification.
 * Changing position.count without updating array buffers is invalid.
 * Kept for API compatibility; implement with proper decimation if needed.
 */
export function optimizeGeometry(geometry, quality = 'high') {
  if (quality === 'low' && geometry.attributes.position.count > 10000) {
    return geometry.clone();
  }
  return geometry;
}
