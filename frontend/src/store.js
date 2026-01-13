import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Global store pour la scène 3D et l'IA.
 * - currentFocus: organe actuellement ciblé par l'IA (string ou null)
 * - setFocus: définit l'organe ciblé
 * - clearFocus: reset de la focalisation
 * - lastReply: dernier texte de réponse IA (pour debug éventuel)
 */
export const useSceneStore = create(
  subscribeWithSelector((set) => ({
    currentFocus: null,
    lastReply: '',
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
    analyzedReport: null,
    setAnalyzedReport: (report) =>
      set({
        analyzedReport: report,
      }),
  })),
);

