const MODELS_BASE_URL = (import.meta.env.VITE_MODELS_BASE_URL || '').replace(/\/+$/, '');

export function preloadCriticalAssets() {
  const base = MODELS_BASE_URL || '';
  void fetch(`${base}/models/segments/aorta.obj`).catch(() => {});
  void fetch(`${base}/models/segments/aorta.mtl`).catch(() => {});
}
