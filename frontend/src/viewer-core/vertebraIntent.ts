/**
 * Same vertebra parsing as backend `backend/lib/focusSanitize.js` (keep regexes aligned).
 * Used client-side when the API omits `FOCUS_ORGAN` but the user clearly asked for a vertebra.
 */

function normalizeFocusToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VERT_LETTER_MAX: Record<string, number> = { c: 7, t: 12, l: 5, s: 5 };

function tryParseVertebraLower(lower: string): string | null {
  let m = lower.match(/\b([ctls])\s*-?\s*(\d{1,2})\s*(?:vertebra|vertebre|vertèbre)?\b/);
  if (m) {
    const letter = m[1].toLowerCase();
    const num = parseInt(m[2], 10);
    const max = VERT_LETTER_MAX[letter];
    if (!max || num < 1 || num > max) return null;
    return `${letter}${num} vertebra`;
  }

  m = lower.match(/\b(?:vert[eè]bre|vertebra)s?\s+(?:n[o°]?\s*)?(\d{1,2})\b/);
  if (m) {
    const num = parseInt(m[1], 10);
    if (num >= 1 && num <= 7) return `c${num} vertebra`;
    return null;
  }

  m = lower.match(/\b(\d{1,2})\s*(?:ère|ere|er|e)?\s*(?:vert[eè]bre|vertebra)\b/);
  if (m) {
    const num = parseInt(m[1], 10);
    if (num >= 1 && num <= 7) return `c${num} vertebra`;
    return null;
  }

  if (/^[ctls]\d+\s+vertebra$/.test(lower)) {
    m = lower.match(/^([ctls])(\d+)\s+vertebra$/);
    if (m) {
      const letter = m[1].toLowerCase();
      const num = parseInt(m[2], 10);
      const max = VERT_LETTER_MAX[letter];
      if (max && num >= 1 && num <= max) return `${letter}${num} vertebra`;
    }
  }

  return null;
}

export function extractVertebraFocusFromPlainText(rawText: string | null | undefined): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const lower = normalizeFocusToken(rawText);
  return tryParseVertebraLower(lower);
}

/** User clearly asked for a camera / viewer navigation, not only a text answer. */
export const ZOOM_OR_VIEW_INTENT =
  /\b(zoom|focus|show|display|center|centre|go\s+to|take\s+me\s+to|point\s+(?:to|at)|look\s+at)\b/i;
