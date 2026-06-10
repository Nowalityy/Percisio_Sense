import { Icon } from '../psUI.jsx';

export function ViewerLoadingOverlay({ current, total }) {
  const totalNum = Number(total);
  const hasWork = Number.isFinite(totalNum) && totalNum > 0;
  const totalSafe = hasWork ? totalNum : 0;
  const progress = hasWork ? Math.min(100, Math.round((Number(current) / totalSafe) * 100)) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', background: 'rgba(10,12,15,0.88)' }}>
      <div style={{ background: 'rgba(14,19,26,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '24px 28px', textAlign: 'center', width: 'min(420px,88%)' }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8ea0b4', fontFamily: 'var(--font-mono)' }}>
          Loading 3D Viewer
        </p>
        <p style={{ marginTop: 8, fontSize: 13, color: '#e8edf2' }}>
          {hasWork ? 'Preparing anatomical model…' : 'No segment list for this study.'}
        </p>
        {hasWork ? (
          <>
            <div style={{ marginTop: 16, height: 3, background: 'rgba(255,255,255,0.14)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#00D4FF', width: `${progress}%`, transition: 'width 300ms ease-out' }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#8ea0b4', fontFamily: 'var(--font-mono)' }}>
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
      style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: 'rgba(10,12,15,0.92)', padding: 16 }}
      role="alert"
    >
      <div style={{ background: 'rgba(14,19,26,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '24px 28px', textAlign: 'center', width: 'min(420px,92%)' }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8ea0b4', fontFamily: 'var(--font-mono)' }}>
          3D Viewer
        </p>
        <p style={{ marginTop: 8, fontSize: 13, color: '#e8edf2' }}>{message}</p>
        <button
          type="button"
          onClick={onRetry}
          style={{ marginTop: 16, width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#00D4FF', color: '#00222B', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
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
      style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#00D4FF', background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 20, padding: '6px 13px' }}
      aria-live="polite"
    >
      <span
        className="animate-spin"
        style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00D4FF', borderRadius: '50%' }}
        aria-hidden
      />
      Analyzing…
    </div>
  );
}

export function ViewerStaticOverlays() {
  return (
    <>
      {/* orientation cube — design: .av-cube */}
      <div className="av-cube">
        <span className="ax" style={{ top: 6, left: '50%', transform: 'translateX(-50%)' }}>S</span>
        <span className="ax" style={{ bottom: 6, left: '50%', transform: 'translateX(-50%)' }}>I</span>
        <span className="ax" style={{ left: 6, top: '50%', transform: 'translateY(-50%)' }}>R</span>
        <span className="ax" style={{ right: 6, top: '50%', transform: 'translateY(-50%)' }}>L</span>
        <Icon name="cube" size={20} color="#7e90a4" />
      </div>

      {/* scale bar — design: .av-scale */}
      <div className="av-scale"><span className="bar" /> 20 mm</div>
    </>
  );
}
