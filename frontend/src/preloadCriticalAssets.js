import { segmentAbsoluteUrl } from './config/segmentAssets';
import { getDefaultAnatomySetId, getSegmentListForSet } from './segmentList';

export function preloadCriticalAssets() {
  const setId = getDefaultAnatomySetId();
  const first = getSegmentListForSet(setId)[0];
  if (!first) return;
  void fetch(segmentAbsoluteUrl(first, '.obj', setId)).catch(() => {});
  void fetch(segmentAbsoluteUrl(first, '.mtl', setId)).catch(() => {});
}
