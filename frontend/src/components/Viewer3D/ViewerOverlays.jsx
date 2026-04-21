export function ViewerLoadingOverlay({ current, total }) {
  const totalSafe = Math.max(1, Number(total) || 1);
  const progress = Math.min(100, Math.round((Number(current) / totalSafe) * 100));
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--surface-panel)]/92 backdrop-blur-sm">
      <div className="glass-card w-[min(420px,88%)] p-5 text-center">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--text-secondary)]">
          Loading 3D viewer
        </p>
        <p className="mt-2 text-sm text-[var(--text-primary)]">
          Preparing anatomical model...
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-300 ease-out" // BRAND: #62C5EF
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-3 text-xs text-[var(--text-secondary)]">
          {current} / {totalSafe} segments ({progress}%)
        </div>
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
