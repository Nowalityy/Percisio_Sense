import { Box3, Vector3, Mesh } from 'three';

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
