/** Max number of navigation (camera + focus + visibility) history entries. */
export const MAX_HISTORY_SIZE = 50;

/** Serialize camera state for history (plain numbers, JSON-serializable). */
function serializeCameraState(cameraState) {
  if (!cameraState?.position || !cameraState?.target) return null;
  return {
    position: { x: cameraState.position.x, y: cameraState.position.y, z: cameraState.position.z },
    target: { x: cameraState.target.x, y: cameraState.target.y, z: cameraState.target.z },
    zoom: cameraState.zoom != null ? cameraState.zoom : 1,
    fov: cameraState.fov != null ? cameraState.fov : 50,
  };
}

/**
 * @param {string | null} focus
 * @param {Map<string, boolean>} segmentVisibility
 * @param {{ position: { x, y, z }; target: { x, y, z }; zoom?: number; fov?: number } | null} cameraState
 * @returns {{ focus, segmentVisibility: Map, cameraState: object | null, timestamp: number }}
 */
export function createHistoryState(focus, segmentVisibility, cameraState) {
  return {
    focus,
    segmentVisibility: new Map(segmentVisibility),
    cameraState: serializeCameraState(cameraState),
    timestamp: Date.now(),
  };
}

export function canNavigateBack(historyIndex) {
  return historyIndex > 0;
}

export function canNavigateForward(historyIndex, historyLength) {
  return historyIndex < historyLength - 1;
}
