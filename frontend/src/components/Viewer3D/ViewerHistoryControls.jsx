import { canNavigateBack, canNavigateForward } from '../../utils/historyManager';
import { Icon } from '../psUI.jsx';

/** Design: .av-toptools with two .av-nav arrow buttons. */
export function ViewerHistoryControls({
  historyIndex,
  navigationHistoryLength,
  onNavigate,
}) {
  const canBack = canNavigateBack(historyIndex);
  const canFwd = canNavigateForward(historyIndex, navigationHistoryLength);
  return (
    <div className="av-toptools">
      <button
        type="button"
        onClick={() => onNavigate('back')}
        disabled={!canBack}
        className="av-nav"
        style={{ opacity: canBack ? 1 : 0.35 }}
        title="Previous (Ctrl+Z)"
        aria-label="Previous view"
      >
        <Icon name="arrow-left" size={16} />
      </button>
      <button
        type="button"
        onClick={() => onNavigate('forward')}
        disabled={!canFwd}
        className="av-nav"
        style={{ opacity: canFwd ? 1 : 0.35 }}
        title="Next (Ctrl+Shift+Z)"
        aria-label="Next view"
      >
        <Icon name="arrow-right" size={16} />
      </button>
    </div>
  );
}
