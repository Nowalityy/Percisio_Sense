/**
 * Clinical-assistant trigger config (PER-77).
 *
 * The 2-column (report + hologram) layout drops the fixed assistant column and
 * opens the assistant as a floating modal instead. A trigger button launches it.
 *
 * ── ICON GLYPH ──────────────────────────────────────────────────────────────
 * The trigger's glyph lives in ONE place below.
 *  - 'spark'          → custom four-point sparkle SVG from the design spec
 *                       (`SparkIcon` in `components/psUI.jsx`).
 *  - any other string → Tabler webfont icon of that name (see `Icon` in
 *                       `components/psUI.jsx`, font loaded in `index.html`).
 * Swap the string to change the glyph everywhere the trigger renders — this is
 * the only line that needs to change to pick a different icon.
 */
export const ASSISTANT_TRIGGER_ICON = 'spark';

/**
 * Trigger placement options proposed for review (PER-77 acceptance criteria).
 * The active one is chosen via `assistantTriggerPlacement` in the store, so the
 * options can be flipped through and compared side-by-side at runtime.
 */
export const ASSISTANT_TRIGGER_PLACEMENTS = [
  { id: 'report-bar', label: 'Report bar', hint: 'In the report panel header' },
  { id: 'hologram-bar', label: 'Hologram bar', hint: 'Over the 3D viewer, top-right' },
  { id: 'fab', label: 'Floating button', hint: 'Bottom-right action button' },
  { id: 'header', label: 'Page header', hint: 'In the top toolbar' },
];

export const DEFAULT_ASSISTANT_TRIGGER_PLACEMENT = 'fab';

export function isAssistantTriggerPlacement(id) {
  return ASSISTANT_TRIGGER_PLACEMENTS.some((p) => p.id === id);
}

/** Window states for the assistant modal. */
export const ASSISTANT_WINDOW = {
  NORMAL: 'normal', // docked panel, default size
  EXPANDED: 'expanded', // enlarged
  COLLAPSED: 'collapsed', // minimised to its title bar (context preserved)
};
