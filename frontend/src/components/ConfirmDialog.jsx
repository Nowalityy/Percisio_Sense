import { useEffect, useRef } from 'react';
import { Icon } from './psUI.jsx';

/**
 * Themed confirmation dialog — replaces the raw `window.confirm()` (PER-55).
 *
 * Dismissible with Escape, the × button or a backdrop click. Opening moves
 * focus to Cancel (the safe default) so an accidental Enter never triggers a
 * destructive action. Same overlay/`ps-card` shell as {@link ShareDialog}.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger', // 'danger' | 'default'
  icon = 'alert-triangle',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Focus the safe default once mounted.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const danger = tone === 'danger';
  const tileColor = danger ? 'var(--amber)' : 'var(--accent)';
  const tileBg = danger ? 'var(--amber-dim)' : 'var(--accent-dim)';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(8,12,18,0.55)',
        backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ps-card"
        style={{ width: 'min(380px, 96vw)', overflow: 'hidden' }}
      >
        {/* Header — warning tile · title · close */}
        <div className="row gap10" style={{ padding: '14px 16px 12px', alignItems: 'flex-start' }}>
          <span
            aria-hidden
            style={{
              flex: 'none', width: 34, height: 34, borderRadius: 'var(--r-sm)',
              background: tileBg, display: 'grid', placeItems: 'center',
            }}
          >
            <Icon name={icon} size={18} color={tileColor} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, paddingTop: 8 }}>{title}</span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            style={{ marginLeft: 'auto', paddingTop: 8, color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Body — indented under the title */}
        <div style={{ padding: '0 16px 16px 60px' }}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>{message}</p>
        </div>

        {/* Actions — safe (Cancel) left, primary action right.
            Inline styles (not .ps-btn classes) so they beat the `.ps button`
            reset, mirroring ShareDialog. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 14, borderTop: '1px solid var(--border)' }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              padding: '7px 13px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--muted)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--elevated)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '7px 14px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              border: '1px solid transparent', background: 'var(--accent)', color: 'var(--accent-ink)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.07)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
