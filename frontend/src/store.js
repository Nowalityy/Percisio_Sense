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
    analyzedReport: null, // Stores the content of the analyzed file

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
  })),
);
