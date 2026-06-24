import { useEffect, useRef, useState } from 'react';
import { Icon } from './psUI.jsx';
import { useSceneStore } from '../store.js';

/**
 * Top-bar Notifications (bell) and User (avatar) menus.
 *
 * Placeholder content for now (PER-59) — the dropdowns exist, are accessible
 * (click-outside / Esc to close), and show representative items so the header
 * controls read as functional rather than dead icons.
 */

/** Shared open/close behaviour: toggle button + click-outside + Esc. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const POPOVER_STYLE = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: 300,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-pop)',
  zIndex: 50,
  overflow: 'hidden',
};

const NOTIFICATIONS = [
  { id: 1, icon: 'file-check', cls: 'green', title: 'Report ready', body: 'Case D analysis is complete.', when: 'Just now', unread: true },
  { id: 2, icon: 'edit', cls: 'amber', title: 'Updated finding', body: 'Liver lesion reclassified to high severity.', when: '12 min ago', unread: true },
  { id: 3, icon: 'inbox', cls: 'cyan', title: 'New study assigned', body: 'Thoraco-abdomino-pelvic CT — Case F.', when: '1 h ago', unread: false },
];

export function NotificationsMenu() {
  const { open, setOpen, ref } = useDropdown();
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="ps-btn icon sm"
        title="Notifications"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
      >
        <Icon name="bell" size={17} />
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute', top: 5, right: 5, width: 7, height: 7,
              borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--surface)',
            }}
          />
        )}
      </button>

      {open && (
        <div style={POPOVER_STYLE} role="menu" aria-label="Notifications">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notifications</span>
            <span className="over">{unread} new</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {NOTIFICATIONS.map((n) => (
              <div
                key={n.id}
                role="menuitem"
                tabIndex={0}
                style={{ display: 'flex', gap: 11, padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.unread ? 'var(--accent-dim)' : 'transparent' }}
              >
                <span
                  className={`rp-sec-icon`}
                  style={{ background: `var(--${n.cls}-dim)`, color: n.cls === 'cyan' ? 'var(--accent)' : `var(--${n.cls})`, width: 26, height: 26, flex: 'none' }}
                >
                  <Icon name={n.icon} size={14} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{n.when}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ width: '100%', padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }}
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}

const USER_ITEMS = [
  { id: 'settings', icon: 'settings', label: 'Settings' },
  { id: 'help', icon: 'help-circle', label: 'Help & shortcuts' },
  { id: 'tutorial', icon: 'route', label: 'Show tutorial again' },
  { id: 'signout', icon: 'logout', label: 'Sign out', danger: true },
];

export function UserMenu({ initials = 'PS' }) {
  const { open, setOpen, ref } = useDropdown();
  const startOnboarding = useSceneStore((s) => s.startOnboarding);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="ps-avatar"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: 'pointer' }}
      >
        {initials}
      </button>

      {open && (
        <div style={{ ...POPOVER_STYLE, width: 232 }} role="menu" aria-label="Account">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <span className="ps-avatar" style={{ width: 36, height: 36 }}>{initials}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Percisio Sense</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>clinician@percisio.ai</div>
            </div>
          </div>
          <div style={{ padding: 5 }}>
            {USER_ITEMS.map((it) => (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (it.id === 'tutorial') startOnboarding();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 11px', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 500,
                  color: it.danger ? 'var(--red)' : 'var(--text)', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon name={it.icon} size={16} color={it.danger ? 'var(--red)' : 'var(--muted)'} />
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
