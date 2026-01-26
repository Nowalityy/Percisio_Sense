import { useSceneStore } from '../store';

/**
 * Global utility to focus on an organ from outside the 3D Viewer
 */
export function focusOnOrgan(organKey) {
  const { setFocus } = useSceneStore.getState();
  setFocus(organKey);
}
