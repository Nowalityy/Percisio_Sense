import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { MAX_HISTORY_SIZE } from './utils/historyManager';

/**
 * Global store for the 3D scene and Chat.
 * Uses 'subscribeWithSelector' to allow components (like the Chat)
 * to listen to specific state changes (e.g. analyzedReport).
 */
export const useSceneStore = create(
  subscribeWithSelector((set) => ({
    currentFocus: null,
    lastReply: '',
    analyzedReport: null,
    segmentVisibility: new Map(), // Map<segmentName, boolean>
    navigationHistory: [],
    historyIndex: -1,
    conversationHistory: [],

    // Camera state: getter is set by FocusCamera so history can capture current view
    getCameraState: null,
    setGetCameraState: (fn) => set({ getCameraState: fn }),

    // When navigating history, set this to the entry's cameraState; FocusCamera applies then clears
    pendingCameraRestore: null,
    setPendingCameraRestore: (state) => set({ pendingCameraRestore: state }),

    // Default camera state (position + target) for "Reset view"; set by FocusCamera when bounds are ready
    getDefaultCameraState: null,
    setGetDefaultCameraState: (fn) => set({ getDefaultCameraState: fn }),

    // Incremented when camera interaction ends so Viewer3D can push current view to history
    historyPushRequest: 0,
    requestHistoryPush: () =>
      set((s) => ({ historyPushRequest: (s.historyPushRequest || 0) + 1 })),

    setFocus: (organKey) =>
      set({
        currentFocus: organKey,
      }),
    clearFocus: () =>
      set({
        currentFocus: null,
      }),
    setLastReply: (reply) =>
      set({
        lastReply: reply,
      }),
    setAnalyzedReport: (content) =>
      set({
        analyzedReport: content,
      }),
    setSegmentVisibility: (segmentName, visible) =>
      set((state) => {
        const newMap = new Map(state.segmentVisibility);
        newMap.set(segmentName, visible);
        return { segmentVisibility: newMap };
      }),
    toggleSegmentVisibility: (segmentName) =>
      set((state) => {
        const newMap = new Map(state.segmentVisibility);
        const current = newMap.get(segmentName) ?? true;
        newMap.set(segmentName, !current);
        return { segmentVisibility: newMap };
      }),
    setAllSegmentsVisibility: (visible) =>
      set((state) => {
        const newMap = new Map();
        state.segmentVisibility.forEach((_, key) => {
          newMap.set(key, visible);
        });
        return { segmentVisibility: newMap };
      }),
    addToHistory: (state) =>
      set((current) => {
        const newHistory = [...current.navigationHistory];
        if (current.historyIndex < newHistory.length - 1) {
          newHistory.splice(current.historyIndex + 1);
        }
        newHistory.push(state);
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
        }
        return {
          navigationHistory: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),
    navigateHistory: (direction) =>
      set((state) => {
        if (direction === 'back' && state.historyIndex > 0) {
          return { historyIndex: state.historyIndex - 1 };
        }
        if (direction === 'forward' && state.historyIndex < state.navigationHistory.length - 1) {
          return { historyIndex: state.historyIndex + 1 };
        }
        return state;
      }),
    addToConversationHistory: (message) =>
      set((state) => ({
        conversationHistory: [...state.conversationHistory, message],
      })),
    clearConversationHistory: () =>
      set({
        conversationHistory: [],
      }),
  })),
);
