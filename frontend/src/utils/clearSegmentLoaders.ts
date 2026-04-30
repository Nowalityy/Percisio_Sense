import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { getSegmentListForSet } from '../segmentList';
import { segmentAbsoluteUrl } from '../config/segmentAssets';

/**
 * Drop R3F loader cache entries for every OBJ/MTL in a segment set.
 * Call when switching anatomy sets so GPU/RAM does not retain prior study assets.
 */
export function clearSegmentLoaderCacheForSet(segmentSetId: string | null | undefined): void {
  if (!segmentSetId) return;
  const names = getSegmentListForSet(segmentSetId);
  for (const name of names) {
    try {
      useLoader.clear(MTLLoader, segmentAbsoluteUrl(name, '.mtl', segmentSetId));
      useLoader.clear(OBJLoader, segmentAbsoluteUrl(name, '.obj', segmentSetId));
    } catch {
      // Clear is best-effort; missing cache entries are fine.
    }
  }
}
