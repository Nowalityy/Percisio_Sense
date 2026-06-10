import { canNavigateBack, canNavigateForward } from '../../utils/historyManager';

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
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
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
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
