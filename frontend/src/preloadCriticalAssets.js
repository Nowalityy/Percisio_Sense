import { segmentModelRelativePath } from './config/segmentAssets';
import { getDefaultAnatomySetId, getSegmentListForSet } from './segmentList';

const MODELS_BASE_URL = (import.meta.env.VITE_MODELS_BASE_URL || '').replace(/\/+$/, '');

export function preloadCriticalAssets() {
  const base = MODELS_BASE_URL || '';
  const setId = getDefaultAnatomySetId();
  const first = getSegmentListForSet(setId)[0];
  if (!first) return;
  void fetch(`${base}/${segmentModelRelativePath(first, '.obj', setId)}`).catch(() => {});
  void fetch(`${base}/${segmentModelRelativePath(first, '.mtl', setId)}`).catch(() => {});
}
