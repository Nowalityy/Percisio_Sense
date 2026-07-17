/**
 * Single source of truth for 3D viewer camera and zoom.
 * Edit here for animation speed, zoom limits, and orbit limits.
 */
export const CAMERA = {
  ZOOM_DURATION_MS: 400,
  ZOOM_DISTANCE_MIN: 1.4,
  ZOOM_DISTANCE_MAX: 20,
  /** Keep focus zooms on a consistent frontal axis (+Z). */
  FOCUS_FRONT_SIGN: 1,
  /** World-units: organs smaller than this scale the legacy fallback distance (max dimension). */
  FOCUS_REFERENCE_MAX_DIM: 1.25,
  /** Floor for focus distance — allows framing very small segments (e.g. auriculette). */
  FOCUS_DISTANCE_MIN: 0.42,
  /**
   * 0–1 level for the "organ" zoom (clampZoomDistance): 1 = closest, <1 = a bit further.
   * Mainly used by the legacy path without FOV framing — keep it moderate: most of the framing comes from the FOV padding below.
   */
  FOCUS_ORGAN_ZOOM_LEVEL: 0.88,
  /**
   * FOV framing (lung, liver, heart, …): margin around the mesh bounding sphere.
   * Lower = tighter zoom. Vertebrae / very small volumes: see FOCUS_TINY_MESH_*.
   */
  FOCUS_ORGAN_FRAMING_PADDING: 1.24,
  /** Pull-back after the FOV distance (multiplicative). */
  FOCUS_ORGAN_DISTANCE_MULTIPLIER: 1.1,
  /** Minimum distance ≥ this factor × bounding-sphere radius of the targeted segment. */
  FOCUS_ORGAN_MIN_DISTANCE_FACTOR: 1.14,
  /**
   * If the organ sphere radius < this factor × body sphere radius → distance floor of
   * `FOCUS_TINY_MESH_MIN_RHO_FRAC` × body radius (e.g. a single vertebra, less extreme zoom).
   */
  FOCUS_TINY_MESH_MAX_REL_TO_BODY: 0.25,
  /** Minimum camera–target distance for these small meshes (fraction of the body radius). */
  FOCUS_TINY_MESH_MIN_RHO_FRAC: 1.12,
  /**
   * Orbit dolly limits are derived from the full model bounding sphere (see `getOrbitDistanceLimits`).
   * When the model is not ready, these fallbacks apply.
   */
  ORBIT_FALLBACK_MIN: 0.75,
  ORBIT_FALLBACK_MAX: 28,
  /** With an organ focus: OrbitControls dolly minimum (world units). Keep plausible for small-mesh floor (see FOCUS_TINY_MESH_*). */
  ORBIT_MIN_WITH_FOCUS: 0.52,
  /**
   * Overview (no organ focus), target ≈ body centre.
   * Distance min = max(radius × this, ORBIT_MIN_ABS_FLOOR).
   * PER-52: the bounding-sphere radius is dominated by body HEIGHT, so the old
   * 1.2 × radius stop left the camera ~0.9 × radius away from the torso's
   * front surface — zoom felt blocked long before the mesh. 0.5 × radius lets
   * the dolly reach close to the surface while staying out of the volume on
   * the frontal approach.
   */
  ORBIT_MIN_OUTSIDE_FACTOR: 0.5,
  /** Never below this for overview (avoids degenerate min if radius is tiny). */
  ORBIT_MIN_ABS_FLOOR: 0.3,
  /** Max dolly distance ≈ radius × this (model is normalized to ~max dim 2 → r ≈ 1). */
  ORBIT_MAX_FACTOR_OF_RADIUS: 13,
  /** Hard cap so scroll zoom cannot escape to absurd distances. */
  ORBIT_MAX_ABS_CAP: 55,
  /** If mesh box unknown — see `getPolarAngleLimitsFromMeshWorldBox`. */
  ORBIT_POLAR_FALLBACK_MIN: 0.08,
  ORBIT_POLAR_FALLBACK_MAX: Math.PI - 0.08,
  /**
   * Vertical orbit (polar φ) from mesh Y extent `[min.y, max.y]` and orbit radius ρ.
   * Spread ≈ atan2(halfY, ρ) with halfY = larger of (targetY−minY, maxY−targetY).
   */
  ORBIT_POLAR_MESH_SPREAD_WEIGHT: 0.92,
  /** Extra rad above/below that spread around equator (φ = π/2). */
  ORBIT_POLAR_EXTRA_ABOVE: 0.14,
  ORBIT_POLAR_EXTRA_BELOW: 0.26,
  /** Ensures some tilt range when zoomed very far (spread → 0). */
  ORBIT_POLAR_MIN_HALF_BAND: 0.38,
  /** Hard floor/ceiling toward poles (Three.js φ: 0 = +Y). */
  ORBIT_POLAR_EPS: 0.06,
  /**
   * Default framing looks at midpoint between world `min.y` and `max.y` (+ this bias × height).
   * 0 ⇒ aim at the true vertical center (body centered in the image). Positive pushes the
   * body lower; negative raises it.
   */
  /* Negative = aim below the body's mid-height so the model sits HIGHER in the
     viewport, clearing the bottom overlay controls (Reset view / scale). */
  FIT_VERTICAL_TARGET_BIAS: -0.012,
};

/**
 * OrbitControls min/max distance: scale with model size, stay outside body in overview,
 * allow tight zoom when an organ is focused.
 *
 * @param {number | null | undefined} sphereRadius - world radius from full model AABB (bounding sphere)
 * @param {boolean} hasOrganFocus
 * @returns {{ min: number, max: number }}
 */
export function getOrbitDistanceLimits(sphereRadius, hasOrganFocus) {
  const r =
    sphereRadius != null && Number.isFinite(sphereRadius) && sphereRadius > 0
      ? sphereRadius
      : null;

  if (r == null) {
    return { min: CAMERA.ORBIT_FALLBACK_MIN, max: CAMERA.ORBIT_FALLBACK_MAX };
  }

  const maxD = Math.min(r * CAMERA.ORBIT_MAX_FACTOR_OF_RADIUS, CAMERA.ORBIT_MAX_ABS_CAP);
  const minD = hasOrganFocus
    ? CAMERA.ORBIT_MIN_WITH_FOCUS
    : Math.max(r * CAMERA.ORBIT_MIN_OUTSIDE_FACTOR, CAMERA.ORBIT_MIN_ABS_FLOOR);

  const min = Math.min(minD, maxD * 0.995);
  return { min, max: maxD };
}

/**
 * Polar angle limits for OrbitControls (Three.js: φ from +Y axis, π/2 ≈ horizontal).
 * Uses world AABB Y bounds and current orbit distance — not fixed world coordinates.
 *
 * @param {object | null | undefined} box - `THREE.Box3` world bbox (`.min.y`, `.max.y`)
 * @param {number} orbitRadius - distance camera ↔ target
 * @param {number} targetY - OrbitControls.target.y (world)
 * @returns {{ min: number, max: number }}
 */
export function getPolarAngleLimitsFromMeshWorldBox(box, orbitRadius, targetY) {
  const fbMin = CAMERA.ORBIT_POLAR_FALLBACK_MIN;
  const fbMax = CAMERA.ORBIT_POLAR_FALLBACK_MAX;
  if (
    !box ||
    typeof box.min?.y !== 'number' ||
    typeof box.max?.y !== 'number' ||
    !Number.isFinite(orbitRadius) ||
    orbitRadius <= 0 ||
    !Number.isFinite(targetY)
  ) {
    return { min: fbMin, max: fbMax };
  }

  const ymin = box.min.y;
  const ymax = box.max.y;
  if (!(ymax >= ymin)) {
    return { min: fbMin, max: fbMax };
  }

  const halfY = Math.max(targetY - ymin, ymax - targetY, 1e-8);
  const rho = Math.max(orbitRadius, 1e-4);
  const spread = Math.atan2(halfY, rho);

  const eps = CAMERA.ORBIT_POLAR_EPS;
  const w = CAMERA.ORBIT_POLAR_MESH_SPREAD_WEIGHT;
  let minPolar =
    Math.PI / 2 - spread * w - CAMERA.ORBIT_POLAR_EXTRA_ABOVE;
  let maxPolar =
    Math.PI / 2 + spread * w + CAMERA.ORBIT_POLAR_EXTRA_BELOW;

  const minHalfBand = CAMERA.ORBIT_POLAR_MIN_HALF_BAND;
  if (maxPolar - minPolar < minHalfBand * 2) {
    const mid = (minPolar + maxPolar) / 2;
    minPolar = mid - minHalfBand;
    maxPolar = mid + minHalfBand;
  }

  let minClamp = Math.max(eps, minPolar);
  let maxClamp = Math.min(Math.PI - eps, maxPolar);

  if (minClamp >= maxClamp) {
    const mid = Math.PI / 2;
    const half = Math.max(0.2, spread * w);
    minClamp = Math.max(eps, mid - half);
    maxClamp = Math.min(Math.PI - eps, mid + half);
  }

  return { min: minClamp, max: maxClamp };
}

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
