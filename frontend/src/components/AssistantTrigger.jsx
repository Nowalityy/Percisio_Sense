import { Icon, SparkIcon } from './psUI.jsx';
import { ASSISTANT_TRIGGER_ICON } from '../config/assistant.js';

/**
 * Opens the clinical-assistant modal in the 2-column layout (PER-77).
 *
 * Icon-only sparkle button reproducing the design spec's five states —
 * default (bare glyph), hover (glyph brightens), pressed (rounded elevated
 * fill), focus (rounded ring, no fill), disabled (desaturated glyph). All
 * states live in `.asst-spark-btn` in `percisio-sense.css`.
 *
 * The glyph comes from `ASSISTANT_TRIGGER_ICON` in `config/assistant.js`:
 * the value 'spark' renders the custom {@link SparkIcon} SVG from the spec;
 * any other string falls back to that Tabler webfont icon name.
 *
 * @param {'bar'|'fab'} variant  'bar' = inline button for a toolbar/header;
 *                               'fab' = fixed floating action button.
 * @param {boolean} active       true while the modal is open (pressed state).
 */
export default function AssistantTrigger({ variant = 'bar', active = false, disabled = false, onClick, label = 'Clinical Assistant' }) {
  const fab = variant === 'fab';
  const size = fab ? 19 : 18;
  const glyph =
    ASSISTANT_TRIGGER_ICON === 'spark' ? <SparkIcon size={size} /> : <Icon name={ASSISTANT_TRIGGER_ICON} size={size} />;
  return (
    <button
      type="button"
      className={`asst-spark-btn ${fab ? 'fab' : ''} ${active ? 'on' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {glyph}
      {fab && <span className="asst-fab-label">Clinical Assistant</span>}
    </button>
  );
}
