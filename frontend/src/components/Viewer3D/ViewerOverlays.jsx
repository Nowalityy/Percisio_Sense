export function ViewerLoadingOverlay({ current, total }) {
  const totalNum = Number(total);
  const hasWork = Number.isFinite(totalNum) && totalNum > 0;
  const totalSafe = hasWork ? totalNum : 0;
  const progress = hasWork ? Math.min(100, Math.round((Number(current) / totalSafe) * 100)) : 0;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--surface-panel)]/92 backdrop-blur-sm">
      <div className="glass-card w-[min(420px,88%)] p-5 text-center">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--text-secondary)]">
          Loading 3D viewer
        </p>
        <p className="mt-2 text-sm text-[var(--text-primary)]">
          {hasWork ? 'Preparing anatomical model...' : 'No segment list for this study (check deployment / segmentSets.json).'}
        </p>
        {hasWork ? (
          <>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-300 ease-out" // BRAND: #62C5EF
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 text-xs text-[var(--text-secondary)]">
              {current} / {totalSafe} segments ({progress}%)
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ViewerLoadFailureOverlay({ message, onRetry }) {
  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-[var(--surface-panel)]/95 backdrop-blur-sm px-4"
      role="alert"
    >
      <div className="glass-card w-[min(420px,92%)] p-5 text-center space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          3D viewer
        </p>
        <p className="text-sm text-text">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-2 rounded-xl text-sm font-medium bg-[var(--brand-primary)] text-[var(--text-on-brand)] border border-[var(--border-brand)]"
        >
          Retry loading
        </button>
      </div>
    </div>
  );
}

export function ViewerAnalyzingOverlay({ isAnalyzing }) {
  if (!isAnalyzing) return null;
  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 flex flex-col items-end justify-start pt-3 pr-3 gap-2"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-xs text-[var(--brand-primary-dark)] rounded-full border border-[var(--border-brand)] bg-[var(--brand-primary-light)] px-2.5 py-1.5"> {/* BRAND: #62C5EF */}
        <span className="inline-block w-4 h-4 border-2 border-[var(--border-brand)]/30 border-t-[var(--brand-primary)] rounded-full animate-spin" aria-hidden /> {/* BRAND: #62C5EF */}
        <span>Analyzing anatomical structures…</span>
      </div>
    </div>
  );
}

export function ViewerStaticOverlays() {
  return (
    <>
      <div className="absolute top-[35%] left-4 z-40 glass-card p-2.5 text-[10px] text-text-secondary">
        <div className="w-11 h-11 rounded border border-white/15 grid place-items-center text-text">N</div>
      </div>

      <div className="absolute bottom-6 right-6 z-30 glass-card px-2.5 py-1.5 text-[10px] text-text-secondary">
        <span className="inline-block w-10 h-[2px] bg-[var(--brand-primary)] mr-2 align-middle" /> {/* BRAND: #62C5EF */}
        20 mm
      </div>
    </>
  );
}
