/**
 * Camera state serialization and application for history/restore.
 * Kept in utils so FocusCamera.jsx only exports the component (Fast Refresh).
 */

/** Return JSON-serializable camera state { position, target, zoom, fov }. */
export function serializeCameraStateFromScene(camera, target) {
  if (!camera || !target) return null;
  return {
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    target: { x: target.x, y: target.y, z: target.z },
    zoom: camera.zoom != null ? camera.zoom : 1,
    fov: camera.fov != null ? camera.fov : 50,
  };
}

/** Apply a saved camera state to camera and controls (instant, no animation). */
export function applyCameraState(camera, controls, state) {
  if (!state || !state.position || !state.target || !camera || !controls) return;
  camera.position.set(state.position.x, state.position.y, state.position.z);
  controls.target.set(state.target.x, state.target.y, state.target.z);
  if (state.zoom != null) camera.zoom = state.zoom;
  if (state.fov != null) camera.fov = state.fov;
  camera.updateProjectionMatrix();
  if (typeof controls.update === 'function') controls.update();
}
