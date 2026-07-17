import { Suspense, lazy, useEffect } from 'react';
import { Icon, BrandMark } from './psUI.jsx';
import { SkeletonPanel } from './SkeletonPanel.jsx';
import { useSceneStore } from '../store.js';
import { ASSISTANT_WINDOW } from '../config/assistant.js';

const Chatbot = lazy(() => import('./Chatbot.jsx'));

/**
 * Floating clinical-assistant window for the 2-column layout (PER-77).
 *
 * The assistant is no longer a fixed column here — it opens as a movable modal
 * that can be expanded (enlarged), collapsed (minimised to its title bar) and
 * closed. Collapsing keeps the {@link Chatbot} mounted, so the conversation and
 * any in-flight response survive; closing unmounts it but the thread is restored
 * from the store on reopen. Rendering the modal never touches the report/hologram
 * grid, so opening/closing it can't break the underlying layout.
 */
export default function AssistantModal() {
  const open = useSceneStore((s) => s.assistantModalOpen);
  const windowState = useSceneStore((s) => s.assistantWindowState);
  const close = useSceneStore((s) => s.closeAssistantModal);
  const setWindowState = useSceneStore((s) => s.setAssistantWindowState);

  const collapsed = windowState === ASSISTANT_WINDOW.COLLAPSED;
  const expanded = windowState === ASSISTANT_WINDOW.EXPANDED;

  // Escape closes the window (matches the other dialogs).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const toggleCollapse = () =>
    setWindowState(collapsed ? ASSISTANT_WINDOW.NORMAL : ASSISTANT_WINDOW.COLLAPSED);
  const toggleExpand = () =>
    setWindowState(expanded ? ASSISTANT_WINDOW.NORMAL : ASSISTANT_WINDOW.EXPANDED);

  return (
    <div
      className={`asst-modal state-${windowState}`}
      role="dialog"
      aria-modal="false"
      aria-label="Clinical Assistant"
    >
      <div className="asst-modal-hd">
        <span className="asst-modal-avatar" aria-hidden>
          <BrandMark size={15} />
        </span>
        <span className="asst-modal-title">Clinical Assistant</span>

        <div className="asst-modal-actions">
          <button
            type="button"
            className="asst-modal-btn"
            onClick={toggleExpand}
            aria-label={expanded ? 'Restore window size' : 'Expand window'}
            title={expanded ? 'Restore' : 'Expand'}
          >
            <Icon name={expanded ? 'minimize' : 'maximize'} size={15} />
          </button>
          <button
            type="button"
            className="asst-modal-btn"
            onClick={toggleCollapse}
            aria-label={collapsed ? 'Expand from minimised' : 'Minimise window'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Show' : 'Minimise'}
          >
            <Icon name={collapsed ? 'chevron-up' : 'minus'} size={15} />
          </button>
          <button
            type="button"
            className="asst-modal-btn"
            onClick={close}
            aria-label="Close assistant"
            title="Close"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>

      {/* Kept mounted while collapsed (hidden via CSS) so context is preserved. */}
      <div className="asst-modal-body">
        <Suspense
          fallback={
            <div className="grow" style={{ display: 'grid', placeItems: 'center', minHeight: 0, padding: 16 }} aria-hidden="true">
              <SkeletonPanel lines={3} className="w-[min(84%,30rem)]" />
            </div>
          }
        >
          <Chatbot />
        </Suspense>
      </div>
    </div>
  );
}
