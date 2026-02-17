/**
 * Single source of truth for 3D viewer camera and zoom.
 * Edit here for animation speed, zoom limits, and orbit limits.
 */

export const CAMERA = {
  /** Focus zoom: animation duration (ms). */
  ZOOM_DURATION_MS: 400,
  /** Focus zoom: min distance camera–organ (zoom in). */
  ZOOM_DISTANCE_MIN: 1.4,
  /** Focus zoom: max distance camera–organ (zoom out). */
  ZOOM_DISTANCE_MAX: 20,
  /** OrbitControls: min/max distance. */
  ORBIT_MIN_DISTANCE: 0.5,
  ORBIT_MAX_DISTANCE: 100,
  /** OrbitControls: polar angle limits (rad). */
  ORBIT_MIN_POLAR: 0.1,
  ORBIT_MAX_POLAR: Math.PI - 0.1,
};

/** Zoom level 0..1 → clamped distance (single place for zoom clamp). */
export function clampZoomDistance(level) {
  const n = Number(level);
  const l = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  const range = CAMERA.ZOOM_DISTANCE_MAX - CAMERA.ZOOM_DISTANCE_MIN;
  return Math.max(
    CAMERA.ZOOM_DISTANCE_MIN,
    Math.min(CAMERA.ZOOM_DISTANCE_MAX, CAMERA.ZOOM_DISTANCE_MAX - l * range)
  );
}
