import { SegmentFilterPanel } from './SegmentFilterPanel';

export function ViewerToolbar({ viewMode, viewModes, onModeChange }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-40 flex items-start justify-end gap-2">
      <div className="flex items-center gap-2">
        <SegmentFilterPanel />
        <div className="glass-card p-1.5 flex items-center gap-1">
          {viewModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange(mode)}
              className={`h-8 px-2.5 rounded-md text-[11px] ${
                viewMode === mode
                  ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)]'
                  : 'text-text-secondary hover:text-text'
              }`} // BRAND: #62C5EF
              aria-pressed={viewMode === mode}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
