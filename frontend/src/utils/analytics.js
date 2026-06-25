/**
 * Lightweight analytics shim (PER-66).
 *
 * No provider is wired yet; events are funnelled through this single place so a
 * real provider (PostHog, GA, Plausible, …) can be added later without touching
 * any call site. In dev we log to the console for visibility.
 *
 * @param {string} event - event name, e.g. 'onboarding_started'
 * @param {Record<string, unknown>} [props] - optional event properties
 */
export function track(event, props = {}) {
  if (typeof window === 'undefined') return;
  if (import.meta.env?.DEV) {
    console.debug('[analytics]', event, props);
  }
  // TODO: forward to the real analytics provider once configured.
}
