import { describe, it, expect } from 'vitest';
import {
  MAX_HISTORY_SIZE,
  createHistoryState,
  canNavigateBack,
  canNavigateForward,
} from './historyManager.js';

describe('historyManager', () => {
  describe('MAX_HISTORY_SIZE', () => {
    it('is a positive number', () => {
      expect(MAX_HISTORY_SIZE).toBeGreaterThan(0);
    });
  });

  describe('createHistoryState', () => {
    it('returns object with focus, segmentVisibility Map, cameraState, timestamp', () => {
      const focus = 'heart';
      const segmentVisibility = new Map([['heart', true], ['liver', false]]);
      const state = createHistoryState(focus, segmentVisibility, null);
      expect(state).toHaveProperty('focus', 'heart');
      expect(state).toHaveProperty('segmentVisibility');
      expect(state.segmentVisibility).toBeInstanceOf(Map);
      expect(state.segmentVisibility.get('heart')).toBe(true);
      expect(state.segmentVisibility.get('liver')).toBe(false);
      expect(state).toHaveProperty('cameraState', null);
      expect(state).toHaveProperty('timestamp');
      expect(typeof state.timestamp).toBe('number');
    });

    it('serializes camera state when provided', () => {
      const cameraState = {
        position: { x: 1, y: 2, z: 3 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 1.5,
        fov: 45,
      };
      const state = createHistoryState(null, new Map(), cameraState);
      expect(state.cameraState).toEqual({
        position: { x: 1, y: 2, z: 3 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 1.5,
        fov: 45,
      });
    });

    it('returns null cameraState when position or target missing', () => {
      expect(createHistoryState(null, new Map(), { target: { x: 0, y: 0, z: 0 } }).cameraState).toBeNull();
      expect(createHistoryState(null, new Map(), { position: { x: 1, y: 1, z: 1 } }).cameraState).toBeNull();
      expect(createHistoryState(null, new Map(), {}).cameraState).toBeNull();
    });
  });

  describe('canNavigateBack', () => {
    it('returns false when historyIndex is 0', () => {
      expect(canNavigateBack(0)).toBe(false);
    });
    it('returns false when historyIndex is negative', () => {
      expect(canNavigateBack(-1)).toBe(false);
    });
    it('returns true when historyIndex > 0', () => {
      expect(canNavigateBack(1)).toBe(true);
      expect(canNavigateBack(5)).toBe(true);
    });
  });

  describe('canNavigateForward', () => {
    it('returns false when at last entry', () => {
      expect(canNavigateForward(2, 3)).toBe(false);
      expect(canNavigateForward(0, 1)).toBe(false);
    });
    it('returns true when index < length - 1', () => {
      expect(canNavigateForward(0, 3)).toBe(true);
      expect(canNavigateForward(1, 3)).toBe(true);
    });
    it('returns false when history is empty', () => {
      expect(canNavigateForward(0, 0)).toBe(false);
    });
  });
});
