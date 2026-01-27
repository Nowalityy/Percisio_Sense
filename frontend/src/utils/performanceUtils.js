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

export function optimizeGeometry(geometry, quality = 'high') {
  if (quality === 'low' && geometry.attributes.position.count > 10000) {
    const simplified = geometry.clone();
    simplified.attributes.position.count = Math.floor(simplified.attributes.position.count * 0.5);
    return simplified;
  }
  return geometry;
}
