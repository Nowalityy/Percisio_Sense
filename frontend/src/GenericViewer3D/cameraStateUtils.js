/**
 * Camera state serialization and application for history/restore.
 */

/**
 * Returns a JSON-serializable camera state.
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Vector3} target - controls.target
 * @returns {{ position: {x,y,z}, target: {x,y,z}, zoom: number, fov: number } | null}
 */
export function serializeCameraStateFromScene(camera, target) {
  if (!camera || !target) return null;
  return {
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    target: { x: target.x, y: target.y, z: target.z },
    zoom: camera.zoom != null ? camera.zoom : 1,
    fov: camera.fov != null ? camera.fov : 50,
  };
}

/**
 * Applies a saved camera state (instant, no animation).
 * @param {THREE.PerspectiveCamera} camera
 * @param {{ target: THREE.Vector3, update: function }} controls
 * @param {{ position?: {x,y,z}, target?: {x,y,z}, zoom?: number, fov?: number } | null} state
 */
export function applyCameraState(camera, controls, state) {
  if (!state?.position || !state?.target || !camera || !controls) return;
  camera.position.set(state.position.x, state.position.y, state.position.z);
  controls.target.set(state.target.x, state.target.y, state.target.z);
  if (state.zoom != null) camera.zoom = state.zoom;
  if (state.fov != null) camera.fov = state.fov;
  camera.updateProjectionMatrix();
  if (typeof controls.update === 'function') controls.update();
}
