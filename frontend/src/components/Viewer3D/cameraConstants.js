/**
 * Single source of truth for 3D viewer camera and zoom.
 * Edit here for animation speed, zoom limits, and orbit limits.
 */
export const CAMERA = {
  ZOOM_DURATION_MS: 400,
  ZOOM_DISTANCE_MIN: 1.4,
  ZOOM_DISTANCE_MAX: 20,
  ORBIT_MIN_DISTANCE: 0.5,
  ORBIT_MAX_DISTANCE: 100,
  ORBIT_MIN_POLAR: 0.1,
  ORBIT_MAX_POLAR: Math.PI - 0.1,
};

/**
 * Maps zoom level [0, 1] to clamped distance (single place for zoom clamp).
 * @param {number} level - 0 = far, 1 = close
 * @returns {number}
 */
export function clampZoomDistance(level) {
  const n = Number(level);
  const clampedLevel = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  const range = CAMERA.ZOOM_DISTANCE_MAX - CAMERA.ZOOM_DISTANCE_MIN;
  return Math.max(
    CAMERA.ZOOM_DISTANCE_MIN,
    Math.min(CAMERA.ZOOM_DISTANCE_MAX, CAMERA.ZOOM_DISTANCE_MAX - clampedLevel * range)
  );
}
