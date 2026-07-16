import { Icon, SparkIcon, BrandMark } from './psUI.jsx';
import { ASSISTANT_TRIGGER_ICON } from '../config/assistant.js';

/**
 * Opens the clinical-assistant modal in the 2-column layout (PER-77).
 *
 * Two shapes:
 *  - `fab`  → a floating "Assistant IA" pill that reads as a prompt launcher:
 *             a spark glyph, a label, and a rounded brand avatar on the right.
 *  - `bar`  → a compact icon-only sparkle button for inline toolbars, with the
 *             design spec's default/hover/pressed/focus/disabled states
 *             (`.asst-spark-btn`).
 *
 * The glyph comes from `ASSISTANT_TRIGGER_ICON` in `config/assistant.js`: the
 * value 'spark' renders the custom {@link SparkIcon} SVG; any other string
 * falls back to that Tabler webfont icon name.
 *
 * @param {'bar'|'fab'} variant
 * @param {boolean} active  true while the modal is open (pressed state).
 */
export default function AssistantTrigger({ variant = 'bar', active = false, disabled = false, onClick, label = 'Clinical Assistant' }) {
  const glyph =
    ASSISTANT_TRIGGER_ICON === 'spark' ? <SparkIcon size={16} /> : <Icon name={ASSISTANT_TRIGGER_ICON} size={16} />;

  if (variant === 'fab') {
    return (
      <button
        type="button"
        className={`asst-pill ${active ? 'on' : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        title={label}
      >
        <span className="asst-pill-spark" aria-hidden>{glyph}</span>
        <span className="asst-pill-text">Assistant IA</span>
        <span className="asst-pill-ava" aria-hidden><BrandMark size={16} /></span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`asst-spark-btn ${active ? 'on' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {ASSISTANT_TRIGGER_ICON === 'spark' ? <SparkIcon size={18} /> : <Icon name={ASSISTANT_TRIGGER_ICON} size={18} />}
    </button>
  );
}
