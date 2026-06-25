import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSceneStore } from '../store.js';
import { ONBOARDING_STEPS } from '../config/onboardingSteps.js';
import { track } from '../utils/analytics.js';
import { Icon } from './psUI.jsx';

/**
 * First-run product tour (PER-66). Sequentially spotlights real UI elements
 * with a dark backdrop + a tooltip card (Userpilot/Appcues style). Generic:
 * it renders whatever sequence ONBOARDING_STEPS defines, so new tours can reuse
 * it. Auto-starts once per user (persisted `hasSeenOnboarding`); relaunchable
 * from the account menu via the store's `startOnboarding`.
 */

const SPOT_PAD = 8; // padding around the spotlighted element
const GAP = 14; // gap between target and tooltip
const TOOLTIP_W = 320;
const TOOLTIP_H_EST = 230; // rough height for placement/clamping

/** Keep focus inside the card while the tour is open. */
function trapFocus(e, container) {
  if (!container) return;
  const focusable = container.querySelectorAll(
    'button, [href], input, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export default function OnboardingTour() {
  const onboardingActive = useSceneStore((s) => s.onboardingActive);
  const hasSeenOnboarding = useSceneStore((s) => s.hasSeenOnboarding);
  const startOnboarding = useSceneStore((s) => s.startOnboarding);
  const endOnboarding = useSceneStore((s) => s.endOnboarding);

  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);

  const total = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[stepIndex];

  /* First-run: auto-start once the shell + all target elements are mounted. */
  useEffect(() => {
    if (hasSeenOnboarding || onboardingActive) return undefined;
    let raf = 0;
    let tries = 0;
    const tryStart = () => {
      const ready = ONBOARDING_STEPS.every((s) => document.querySelector(s.target));
      if (ready) {
        startOnboarding();
      } else if (tries++ < 90) {
        raf = requestAnimationFrame(tryStart); // wait up to ~1.5s for lazy panes
      }
    };
    raf = requestAnimationFrame(tryStart);
    return () => cancelAnimationFrame(raf);
  }, [hasSeenOnboarding, onboardingActive, startOnboarding]);

  /* Reset to the first step whenever the tour (re)starts. */
  useEffect(() => {
    if (onboardingActive) {
      setStepIndex(0);
      track('onboarding_started');
    }
  }, [onboardingActive]);

  /* Measure the active target, re-measure on resize/scroll, log step view. */
  useLayoutEffect(() => {
    if (!onboardingActive || !step) return undefined;
    const measure = () => {
      const el = document.querySelector(step.target);
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    track('onboarding_step_viewed', { step: stepIndex + 1 });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [onboardingActive, step, stepIndex]);

  const finish = useCallback(
    (reason) => {
      if (reason === 'completed') track('onboarding_completed');
      else track('onboarding_skipped', { step: stepIndex + 1 });
      // Reset the workspace so anything the user tried during the demo
      // (rotating/zooming the 3D view) doesn't linger into their real session.
      const store = useSceneStore.getState();
      store.setCameraAutoSpin?.(false);
      store.clearCameraFocus?.();
      const def = store.getDefaultCameraState?.();
      if (def) store.setPendingCameraRestore?.(def);
      endOnboarding();
      setRect(null);
    },
    [endOnboarding, stepIndex]
  );

  const next = useCallback(() => {
    track('onboarding_step_completed', { step: stepIndex + 1 });
    if (stepIndex + 1 >= total) finish('completed');
    else setStepIndex((i) => i + 1);
  }, [stepIndex, total, finish]);

  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  /* Keyboard: ESC closes, Tab is trapped; focus the primary button on open. */
  useEffect(() => {
    if (!onboardingActive) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish('skipped');
      } else if (e.key === 'Tab') {
        trapFocus(e, cardRef.current);
      }
    };
    document.addEventListener('keydown', onKey);
    const id = requestAnimationFrame(() =>
      cardRef.current?.querySelector('[data-autofocus]')?.focus()
    );
    return () => {
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(id);
    };
  }, [onboardingActive, stepIndex, finish]);

  if (!onboardingActive || !step || !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  /* Spotlight rect (padded, clamped to the viewport). */
  const sx = Math.max(0, rect.left - SPOT_PAD);
  const sy = Math.max(0, rect.top - SPOT_PAD);
  const sw = Math.min(vw - sx, rect.width + SPOT_PAD * 2);
  const sh = Math.min(vh - sy, rect.height + SPOT_PAD * 2);

  /* Tooltip placement: prefer below the target, flip above if tight; clamp. */
  const roomBelow = vh - (sy + sh);
  const placeBelow = roomBelow >= TOOLTIP_H_EST + GAP;
  let top = placeBelow ? sy + sh + GAP : sy - GAP - TOOLTIP_H_EST;
  top = Math.max(GAP, Math.min(top, vh - TOOLTIP_H_EST - GAP));
  let left = sx + sw / 2 - TOOLTIP_W / 2;
  left = Math.max(GAP, Math.min(left, vw - TOOLTIP_W - GAP));

  const isLast = stepIndex + 1 >= total;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onb-title"
      aria-describedby="onb-desc"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}
    >
      {/* Spotlight — dims everything but the target via a huge box-shadow. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: sy,
          left: sx,
          width: sw,
          height: sh,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(8,12,18,0.62)',
          outline: '2px solid var(--accent)',
          outlineOffset: 0,
          transition: 'top .2s ease, left .2s ease, width .2s ease, height .2s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Click-blocking strips around the spotlight hole. The target itself is
          left uncovered so the user can actually try it (rotate/zoom/scroll)
          during the demo; only the dimmed area blocks interaction. */}
      <div aria-hidden style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: sy, pointerEvents: 'auto' }} />
      <div aria-hidden style={{ position: 'fixed', top: sy + sh, left: 0, width: '100vw', height: Math.max(0, vh - (sy + sh)), pointerEvents: 'auto' }} />
      <div aria-hidden style={{ position: 'fixed', top: sy, left: 0, width: sx, height: sh, pointerEvents: 'auto' }} />
      <div aria-hidden style={{ position: 'fixed', top: sy, left: sx + sw, width: Math.max(0, vw - (sx + sw)), height: sh, pointerEvents: 'auto' }} />

      {/* Tooltip card. */}
      <div
        ref={cardRef}
        className="ps-card"
        style={{
          position: 'fixed',
          top,
          left,
          width: `min(${TOOLTIP_W}px, calc(100vw - ${GAP * 2}px))`,
          padding: 16,
          boxShadow: 'var(--shadow-pop)',
          pointerEvents: 'auto',
        }}
      >
        <div className="row gap10" style={{ alignItems: 'flex-start' }}>
          <span style={{ minWidth: 0 }}>
            <span className="over" style={{ display: 'block', color: 'var(--accent)', marginBottom: 4 }}>
              {stepIndex + 1} / {total}
            </span>
            <h3 id="onb-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {step.title}
            </h3>
          </span>
          <button
            type="button"
            onClick={() => finish('skipped')}
            aria-label="Close tutorial"
            style={{ marginLeft: 'auto', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        <p id="onb-desc" style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>
          {step.description}
        </p>

        {step.hint && (
          <div
            style={{
              marginTop: 12, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
              borderRadius: 'var(--r-sm)', background: 'var(--accent-dim)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            }}
          >
            <span
              style={{
                flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999, background: 'var(--accent)',
                color: 'var(--accent-ink)', fontSize: 10, fontWeight: 800, letterSpacing: '0.4px',
              }}
            >
              <Icon name="click" size={12} color="var(--accent-ink)" /> CLICK
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{step.hint}</span>
          </div>
        )}

        {step.example && (
          <div
            style={{
              marginTop: 12, padding: '9px 11px', borderRadius: 'var(--r-sm)',
              background: 'var(--accent-dim)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            }}
          >
            <span className="over" style={{ display: 'block', color: 'var(--accent)', marginBottom: 3 }}>Try asking</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>“{step.example}”</span>
          </div>
        )}

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, marginTop: 14 }}>
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s.id}
              style={{
                height: 5, flex: 1, borderRadius: 999,
                background: i <= stepIndex ? 'var(--accent)' : 'var(--border-strong)',
                transition: 'background .2s',
              }}
            />
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => finish('skipped')}
            style={{
              padding: '7px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600,
            }}
          >
            Skip tour
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={prev}
                style={{
                  padding: '7px 13px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                  border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--elevated)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              data-autofocus
              onClick={next}
              style={{
                padding: '7px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                border: '1px solid transparent', background: 'var(--accent)', color: 'var(--accent-ink)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.07)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
