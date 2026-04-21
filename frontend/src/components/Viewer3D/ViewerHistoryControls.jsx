import { canNavigateBack, canNavigateForward } from '../../utils/historyManager';

export function ViewerHistoryControls({
  historyIndex,
  navigationHistoryLength,
  onNavigate,
}) {
  return (
    <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
      <button
        type="button"
        onClick={() => onNavigate('back')}
        disabled={!canNavigateBack(historyIndex)}
        className="glass-btn px-3 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium text-slate-100"
        title="Previous (Ctrl+Z)"
        aria-label="Previous view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onNavigate('forward')}
        disabled={!canNavigateForward(historyIndex, navigationHistoryLength)}
        className="glass-btn px-3 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium text-slate-100"
        title="Next (Ctrl+Shift+Z)"
        aria-label="Next view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
