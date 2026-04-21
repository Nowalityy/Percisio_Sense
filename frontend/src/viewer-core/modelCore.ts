import { Box3, MathUtils, Vector3, Group } from 'three';

export const MODEL_CORE = {
  rotationLerpFactor: 0.1,
  autoSpinSpeed: 0.5,
  scaleFactor: 2,
} as const;

export function applyModelRotation(
  group: Group | null | undefined,
  rotation: { x: number; y: number; z: number },
  isAutoSpinning: boolean,
  delta: number
): boolean {
  if (!group) return false;

  if (isAutoSpinning) {
    group.rotation.y += delta * MODEL_CORE.autoSpinSpeed;
    return true;
  }

  const nextX = MathUtils.lerp(group.rotation.x, rotation.x, MODEL_CORE.rotationLerpFactor);
  const nextY = MathUtils.lerp(group.rotation.y, rotation.y, MODEL_CORE.rotationLerpFactor);
  const nextZ = MathUtils.lerp(group.rotation.z, rotation.z, MODEL_CORE.rotationLerpFactor);
  const changed =
    Math.abs(group.rotation.x - nextX) > 1e-4 ||
    Math.abs(group.rotation.y - nextY) > 1e-4 ||
    Math.abs(group.rotation.z - nextZ) > 1e-4;

  group.rotation.x = nextX;
  group.rotation.y = nextY;
  group.rotation.z = nextZ;
  return changed;
}

export function centerModelInGroup(
  segmentsGroup: Group | null | undefined,
  rootGroup: Group | null | undefined
): void {
  if (!segmentsGroup || !rootGroup) return;

  segmentsGroup.position.set(0, 0, 0);
  const box = new Box3().setFromObject(segmentsGroup);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  if (size.x === 0 && size.y === 0 && size.z === 0) return;

  const maxDimension = Math.max(size.x, size.y, size.z);
  if (maxDimension === 0) return;

  const scale = MODEL_CORE.scaleFactor / maxDimension;
  rootGroup.scale.set(scale, scale, scale);
  segmentsGroup.position.set(-center.x, -center.y, -center.z);
}
