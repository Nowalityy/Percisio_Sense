import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { MAX_HISTORY_SIZE } from './utils/historyManager';

/**
 * Global store for the 3D scene and Chat.
 * Uses 'subscribeWithSelector' to allow components (like the Chat)
 * to listen to specific state changes (e.g. analyzedReport).
 * Uses 'persist' to keep the conversation state across refreshes.
 */
export const useSceneStore = create(
  subscribeWithSelector(
    persist(
      (set) => ({
        currentFocus: null,
        /** Organ keys from report cards; user can cycle through them. */
        citedOrgans: [],
        citedOrganIndex: 0,
        lastReply: '',
        analyzedReport: null,
        lastCards: [],
        lastMeta: null,
        /** Currently-selected DICOM study id; null means viewer is locked. */
        selectedDicom: null,
        setSelectedDicom: (dicomId) =>
          set({ selectedDicom: dicomId ?? null }),
        segmentVisibility: new Map(), // Map<segmentName, boolean>
        navigationHistory: [],
        historyIndex: -1,
        conversationHistory: [],

        /** True while the AI is processing (report or chat); used by viewer for desaturation + overlay */
        isAnalyzing: false,
        setAnalyzing: (value) => set({ isAnalyzing: Boolean(value) }),

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
            citedOrgans: [],
            citedOrganIndex: 0,
          }),
        /** Clear zoom/target only; keep citedOrgans from the report for organ cycling. */
        clearCameraFocus: () =>
          set({
            currentFocus: null,
          }),
        /** Set the list of organ keys from report cards; resets index to 0. */
        setCitedOrgans: (organKeys) =>
          set({
            citedOrgans: Array.isArray(organKeys) ? organKeys : [],
            citedOrganIndex: 0,
          }),
        setCitedOrganIndex: (index) =>
          set((state) => {
            const i = Math.max(0, Math.min(index, state.citedOrgans.length - 1));
            const organ = state.citedOrgans[i] ?? null;
            return { citedOrganIndex: i, currentFocus: organ };
          }),
        goToNextCitedOrgan: () =>
          set((state) => {
            if (!state.citedOrgans.length) return state;
            const next = (state.citedOrganIndex + 1) % state.citedOrgans.length;
            return { citedOrganIndex: next, currentFocus: state.citedOrgans[next] };
          }),
        goToPrevCitedOrgan: () =>
          set((state) => {
            if (!state.citedOrgans.length) return state;
            const prev =
              state.citedOrganIndex <= 0
                ? state.citedOrgans.length - 1
                : state.citedOrganIndex - 1;
            return { citedOrganIndex: prev, currentFocus: state.citedOrgans[prev] };
          }),
        setLastReply: (reply) =>
          set({
            lastReply: reply,
          }),
        /**
         * Set report text. When the report content actually changes (new upload),
         * clear findings, organ focus, and conversation so previous reports do not linger.
         */
        setAnalyzedReport: (content) =>
          set((state) => {
            const stored = typeof content === 'string' ? content : null;
            const nextNorm = stored?.trim() ? stored.trim() : '';
            const prevStored = state.analyzedReport;
            const prevNorm =
              typeof prevStored === 'string' && prevStored.trim() ? prevStored.trim() : '';
            const replaced = nextNorm.length > 0 && nextNorm !== prevNorm;

            return {
              analyzedReport: stored,
              ...(replaced
                ? {
                    lastCards: [],
                    lastMeta: null,
                    citedOrgans: [],
                    citedOrganIndex: 0,
                    currentFocus: null,
                    lastReply: '',
                    conversationHistory: [],
                  }
                : {}),
            };
          }),
        setLastCards: (cards) => set({ lastCards: Array.isArray(cards) ? cards : [] }),
        setLastMeta: (meta) => set({ lastMeta: meta }),
        setSegmentVisibility: (segmentName, visible) =>
          set((state) => {
            const newMap = new Map(state.segmentVisibility);
            newMap.set(segmentName, visible);
            return { segmentVisibility: newMap };
          }),
        setManySegmentVisibility: (entries) =>
          set((state) => {
            const newMap = new Map(state.segmentVisibility);
            if (entries instanceof Map) {
              entries.forEach((visible, segmentName) => {
                newMap.set(segmentName, Boolean(visible));
              });
              return { segmentVisibility: newMap };
            }
            if (entries && typeof entries === 'object') {
              Object.entries(entries).forEach(([segmentName, visible]) => {
                newMap.set(segmentName, Boolean(visible));
              });
            }
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
        resetStore: () =>
          set({
            conversationHistory: [],
            analyzedReport: null,
            lastReply: '',
            citedOrgans: [],
            citedOrganIndex: 0,
            currentFocus: null,
            lastCards: [],
            lastMeta: null,
            selectedDicom: null,
          }),
      }),
      {
        name: 'percisio-sense-storage',
        /**
         * Do not persist DICOM selection, report, findings, or chat messages.
         * Each new session (refresh or "new session" button) must start fresh
         * — user re-selects a DICOM to unlock the viewer and load the report.
         */
        partialize: () => ({}),
        merge: (_persistedState, currentState) => ({
          ...currentState,
          conversationHistory: [],
        }),
      }
    )
  )
);


