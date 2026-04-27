import { Box3, Sphere, Vector3, Mesh, Object3D, PerspectiveCamera } from 'three';

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getVisibleMeshesBoundingBox(meshes: Mesh[] | null | undefined): Box3 | null {
  if (!meshes?.length) return null;
  const box = new Box3();
  for (const mesh of meshes) {
    if (mesh.visible && mesh.geometry) {
      box.expandByObject(mesh);
    }
  }
  const size = box.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  return maxDim < 1e-6 ? null : box;
}

export function computeFocusTarget(
  organCenter: Vector3 | null | undefined,
  organSize: Vector3 | null | undefined,
  zoomLevel: number,
  clampZoomDistance: (level: number) => number,
  cameraConfig: {
    FOCUS_REFERENCE_MAX_DIM: number;
    FOCUS_DISTANCE_MIN: number;
    ZOOM_DISTANCE_MAX: number;
    FOCUS_FRONT_SIGN: number;
  }
): { cameraPosition: Vector3; target: Vector3 } | null {
  if (!organCenter) return null;

  let distance = clampZoomDistance(zoomLevel);
  if (organSize) {
    const maxDim = Math.max(organSize.x, organSize.y, organSize.z);
    if (maxDim > 1e-6 && Number.isFinite(maxDim)) {
      const scaled = distance * (maxDim / cameraConfig.FOCUS_REFERENCE_MAX_DIM);
      distance = Math.max(
        cameraConfig.FOCUS_DISTANCE_MIN,
        Math.min(cameraConfig.ZOOM_DISTANCE_MAX, scaled)
      );
    }
  }

  return {
    cameraPosition: new Vector3(
      organCenter.x,
      organCenter.y,
      organCenter.z + cameraConfig.FOCUS_FRONT_SIGN * distance
    ),
    target: organCenter.clone(),
  };
}

export interface FitCameraResult {
  position: Vector3;
  target: Vector3;
  near: number;
  far: number;
}

/**
 * Frame a perspective camera so the given bounding box is fully visible from
 * a standard medical anterior view (front of the patient, slightly elevated).
 *
 * Distance is derived from the bounding sphere's radius and the camera's FOV
 * so the entire volume fits the viewport regardless of model size. Near/far
 * planes are scaled to the volume to avoid clipping or z-fighting.
 *
 * @param box       - World-space bounding box of the model
 * @param camera    - Perspective camera (uses `fov`, `aspect`)
 * @param padding   - Extra room around the model (1 = tight, 1.2 = 20% margin)
 * @param elevation - Vertical offset (in radii) for the slightly-elevated view
 */
export function fitCameraToBoundingBox(
  box: Box3,
  camera: PerspectiveCamera,
  padding: number = 1.15,
  elevation: number = 0.1
): FitCameraResult | null {
  if (box.isEmpty()) return null;

  const sphere = box.getBoundingSphere(new Sphere());
  const radius = sphere.radius;
  if (!Number.isFinite(radius) || radius <= 0) return null;

  const center = box.getCenter(new Vector3());

  // Distance to fit the bounding sphere in the *narrower* of vertical/horizontal FOV.
  const fovRad = ((camera.fov ?? 50) * Math.PI) / 180;
  const aspect = camera.aspect && camera.aspect > 0 ? camera.aspect : 1;
  const verticalDistance = radius / Math.sin(fovRad / 2);
  const horizontalFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
  const horizontalDistance = radius / Math.sin(horizontalFovRad / 2);
  const distance = Math.max(verticalDistance, horizontalDistance) * padding;

  // Anterior view convention: camera in front of patient on +Z, slightly above.
  const position = new Vector3(
    center.x,
    center.y + radius * elevation,
    center.z + distance
  );

  return {
    position,
    target: center,
    near: Math.max(distance - radius * 2, radius * 0.01, 0.001),
    far: distance + radius * 4,
  };
}

/**
 * World-space bounding box of an object (and all its descendants), recomputed
 * from current matrices. Wrapper around `Box3.setFromObject` that returns null
 * if the box is empty (no visible geometry).
 */
export function getWorldBoundingBox(obj: Object3D | null | undefined): Box3 | null {
  if (!obj) return null;
  const box = new Box3().setFromObject(obj);
  if (box.isEmpty()) return null;
  return box;
}
