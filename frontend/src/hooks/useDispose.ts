import { useEffect } from 'react';
import type {
  BufferGeometry,
  Material,
  Object3D,
  Texture,
  WebGLRenderer,
} from 'three';

type DisposableLike = {
  dispose?: () => void;
};

function disposeMaterial(material: Material | Material[]) {
  const mats = Array.isArray(material) ? material : [material];
  for (const mat of mats) {
    const values = Object.values(mat as unknown as Record<string, unknown>);
    for (const value of values) {
      const tex = value as Texture;
      if (tex && typeof tex === 'object' && tex.isTexture === true) {
        tex.dispose();
      }
    }
    mat.dispose?.();
  }
}

export function disposeObject3D(root: Object3D | null | undefined) {
  if (!root) return;
  root.traverse((node) => {
    const typed = node as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    // PERF: Dispose geometry buffers to avoid VRAM leaks.
    typed.geometry?.dispose?.();
    if (typed.material) {
      disposeMaterial(typed.material);
    }
  });
}

export function useDispose(
  getTargets: () => Array<DisposableLike | Object3D | null | undefined>,
  deps: unknown[] = []
) {
  useEffect(() => {
    return () => {
      const targets = getTargets();
      for (const target of targets) {
        if (!target) continue;
        if ('traverse' in (target as Record<string, unknown>)) {
          disposeObject3D(target as Object3D);
          continue;
        }
        (target as DisposableLike).dispose?.();
      }
    };
  }, deps);
}

export function disposeRenderer(renderer: WebGLRenderer | null | undefined) {
  if (!renderer) return;
  // PERF: Flush internal renderer caches.
  renderer.renderLists?.dispose?.();
  // PERF: Dispose GL resources created by renderer.
  renderer.dispose();
  // PERF: Force context loss to free GPU memory aggressively on teardown.
  renderer.forceContextLoss?.();
}
