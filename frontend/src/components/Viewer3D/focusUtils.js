import { useSceneStore } from '../../store';
import { getSegmentListForSet } from '../../segmentList';
import {
  CATEGORY_MATCHES,
  cardTitleToFocusKey as mapCardTitleToFocusKey,
  getSegmentNamesForFocusInList,
  getFocusSegmentSet as buildFocusSegmentSet,
} from '../../viewer-core/segmentRules';

export { CATEGORY_MATCHES };

export function cardTitleToFocusKey(title) {
  return mapCardTitleToFocusKey(title);
}

function activeSegmentList() {
  const setId = useSceneStore.getState().anatomySegmentSet;
  return getSegmentListForSet(setId);
}

export function getSegmentNamesForFocus(focusKey) {
  return getSegmentNamesForFocusInList(focusKey, activeSegmentList());
}

export function getFocusSegmentSet(focusKey) {
  return buildFocusSegmentSet(focusKey, activeSegmentList());
}

export function isSegmentInFocus(segmentName, focusKey) {
  if (!focusKey || !segmentName) return false;
  return getFocusSegmentSet(focusKey).has(segmentName);
}

/**
 * Finds all meshes in the scene whose name matches the focus key.
 * @param {THREE.Scene} scene
 * @param {string} focusName
 * @returns {THREE.Mesh[]}
 */
export function findOrganMeshes(scene, focusName) {
  if (!scene || !focusName || typeof focusName !== 'string') return [];
  const segmentNames = getSegmentNamesForFocus(focusName);
  if (segmentNames.length === 0) return [];

  const result = [];
  const namesSet = new Set(segmentNames.map((segmentName) => segmentName.toLowerCase()));

  scene.traverse((child) => {
    if (!child.isMesh || !child.name) return;
    const normalized = child.name.toLowerCase();
    if (namesSet.has(normalized)) {
      result.push(child);
      return;
    }
    if (segmentNames.some((segmentName) => normalized.includes(segmentName.toLowerCase()))) {
      result.push(child);
    }
  });

  return result;
}
