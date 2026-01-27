import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

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
        if (newHistory.length > 50) {
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
