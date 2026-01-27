const MAX_HISTORY_SIZE = 50;

export function createHistoryState(focus, segmentVisibility, cameraState) {
  return {
    focus,
    segmentVisibility: new Map(segmentVisibility),
    cameraState: cameraState ? { ...cameraState } : null,
    timestamp: Date.now(),
  };
}

export function canNavigateBack(historyIndex) {
  return historyIndex > 0;
}

export function canNavigateForward(historyIndex, historyLength) {
  return historyIndex < historyLength - 1;
}

export function addToHistory(history, state, currentIndex) {
  const newHistory = [...history];
  
  if (currentIndex < newHistory.length - 1) {
    newHistory.splice(currentIndex + 1);
  }
  
  newHistory.push(state);
  
  if (newHistory.length > MAX_HISTORY_SIZE) {
    newHistory.shift();
  }
  
  return {
    history: newHistory,
    index: newHistory.length - 1,
  };
}

export function getHistoryState(history, index) {
  if (index < 0 || index >= history.length) {
    return null;
  }
  return history[index];
}
