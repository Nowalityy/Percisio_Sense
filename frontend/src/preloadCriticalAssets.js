export function preloadCriticalAssets() {
  // PERF: Preload currently available default assets without importing heavy 3D libs.
  void fetch('/models/segments/aorta.obj').catch(() => {});
  void fetch('/models/segments/aorta.mtl').catch(() => {});
}
