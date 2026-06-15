/**
 * Server-Sent Events helpers for the streaming chat endpoint.
 * Kept tiny and pure so the wire format can be unit-tested.
 */

/** Serialize one event as an SSE `data:` frame (JSON payload). */
export function sseEvent(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/** Terminal frame the client watches for. */
export const SSE_DONE = 'data: [DONE]\n\n';
