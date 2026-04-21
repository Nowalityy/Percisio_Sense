import { useEffect } from 'react';
import type { RefObject } from 'react';

const registry =
  typeof FinalizationRegistry !== 'undefined'
    ? new FinalizationRegistry((token) => {
        // PERF: Warn when objects survive unexpectedly long with retained refs.
        console.warn(`[leak-detector] finalized: ${String(token)}`);
      })
    : null;

/**
 * Dev-only leak detection: registers the ref's current object in a
 * FinalizationRegistry so we can see if it survives past its expected lifetime.
 *
 * Pass the ref object itself (not `ref.current`) — the hook reads `.current`
 * inside the effect so it sees the actual mounted DOM node / instance.
 */
export function useLeakDetector(
  label: string,
  ref: RefObject<object | null> | null | undefined
) {
  useEffect(() => {
    if (
      !import.meta.env.DEV ||
      !registry ||
      !ref ||
      typeof window === 'undefined' ||
      !window.__PERF_NON_CRITICAL_READY__
    ) {
      return;
    }
    const value = ref.current;
    if (!value) return;
    registry.register(value, label, value);
    return () => {
      registry.unregister(value);
    };
  }, [label, ref]);
}
