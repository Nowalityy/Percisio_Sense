import { useEffect, useMemo, useState } from 'react';
import { Icon } from './psUI.jsx';
import {
  collectReportData,
  buildShareText,
  shareViaEmail,
  shareViaWhatsApp,
  downloadReportText,
  copyToClipboard,
} from '../utils/shareReport.js';

/**
 * Share the clinical report by copy / email / WhatsApp / download (PER-62).
 *
 * Clean single-surface modal (Figma/Loom-inspired): a prominent "Copy" primary
 * action plus a row of channel buttons — no inline preview. Anonymization is ON
 * by default; turning it OFF surfaces a prominent warning. Email/WhatsApp open
 * the user's client PRE-FILLED — nothing is sent automatically.
 */
export default function ShareDialog({ meta, reportBy, onClose }) {
  const [anonymize, setAnonymize] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reportData = useMemo(() => collectReportData({ meta, reportBy }), [meta, reportBy]);
  const { subject, body } = useMemo(
    () => buildShareText(reportData, { anonymize }),
    [reportData, anonymize]
  );

  const doCopy = async () => {
    const ok = await copyToClipboard(body);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1800);
  };

  const fileName = `percisio-report-${String(meta?.caseLabel || 'case').replace(/[^\w.-]+/g, '_')}.txt`;

  const channels = [
    { id: 'email', label: 'Email', icon: 'mail', onClick: () => shareViaEmail(subject, body) },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'brand-whatsapp', onClick: () => shareViaWhatsApp(body) },
    { id: 'download', label: 'Download', icon: 'file-download', onClick: () => downloadReportText(fileName, body) },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,12,18,0.55)',
        backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Share report"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ps-card"
        style={{ width: 'min(420px, 96vw)', overflow: 'hidden' }}
      >
        {/* Header — icon tile · title + subtitle · close */}
        <div className="row gap10" style={{ padding: '16px 18px 14px', alignItems: 'flex-start' }}>
          <span
            aria-hidden
            style={{ flex: 'none', width: 32, height: 32, borderRadius: 'var(--r-sm)', background: 'var(--accent-dim)', display: 'grid', placeItems: 'center' }}
          >
            <Icon name="share-2" size={16} color="var(--accent)" />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Share report</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>A text summary — nothing is sent until you confirm.</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ padding: '0 18px 18px' }}>
          {/* Anonymize toggle */}
          <button
            type="button"
            onClick={() => setAnonymize((v) => !v)}
            aria-pressed={anonymize}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
              padding: '11px 13px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              border: '1px solid var(--border-strong)', background: 'var(--elevated)',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'relative', flex: 'none', width: 38, height: 22, borderRadius: 999,
                background: anonymize ? 'var(--accent)' : 'var(--faint)', transition: 'background .15s',
              }}
            >
              <span style={{ position: 'absolute', top: 2, left: anonymize ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Anonymize patient data</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>Removes names, IDs and dates from the shared report.</span>
            </span>
          </button>

          {/* Non-anonymized warning */}
          {!anonymize && (
            <div
              role="alert"
              style={{
                display: 'flex', gap: 9, marginTop: 12, padding: '11px 13px', borderRadius: 'var(--r-sm)',
                background: 'var(--red-dim)', border: '1px solid color-mix(in srgb, var(--red) 45%, transparent)',
              }}
            >
              <Icon name="alert-triangle" size={16} color="var(--red)" style={{ flex: 'none', marginTop: 1 }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--red)', fontWeight: 600 }}>
                You are about to share a NON-anonymized report. It may contain patient-identifying information — only proceed if the recipient is authorized.
              </span>
            </div>
          )}

          {/* Primary action — Copy (Figma-style prominent) */}
          <button
            type="button"
            onClick={doCopy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              marginTop: 14, padding: '11px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              border: '1px solid transparent', background: 'var(--accent)', color: 'var(--accent-ink)',
              fontSize: 13.5, fontWeight: 700,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.07)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            <Icon name={copied ? 'check' : 'copy'} size={17} color="var(--accent-ink)" />
            {copied ? 'Copied to clipboard' : 'Copy report text'}
          </button>

          {/* Channels (Loom-style row) */}
          <div className="over" style={{ margin: '16px 0 8px' }}>Or share via</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={c.onClick}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 6px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  border: '1px solid var(--border-strong)', background: 'var(--elevated)',
                  color: 'var(--text)', fontSize: 12, fontWeight: 600,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 45%, transparent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              >
                <Icon name={c.icon} size={19} color="var(--accent)" />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
