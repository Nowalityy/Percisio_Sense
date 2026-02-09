import { useState, useEffect, useRef } from 'react';
import { useSceneStore } from '../../store';

export function ConversationHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const conversationHistory = useSceneStore((s) => s.conversationHistory);
  const clearConversationHistory = useSceneStore((s) => s.clearConversationHistory);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="glass-btn px-2 py-1 text-xs text-text-secondary hover:text-text transition-colors rounded-xl"
        title="Conversation history"
        aria-label="Open conversation history"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="M7 16l4-4 4 4 6-6" />
        </svg>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 z-20 bg-white rounded-2xl border border-border shadow-xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="conv-history-title">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-slate-50 rounded-t-2xl">
        <h3 id="conv-history-title" className="text-sm font-semibold text-text">Conversation History</h3>
        <div className="flex items-center gap-2">
          {conversationHistory.length > 0 && (
            <button
              type="button"
              onClick={clearConversationHistory}
              className="text-xs text-text-secondary hover:text-text transition-colors"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 text-text-secondary hover:text-text transition-colors rounded"
            aria-label="Close conversation history"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {conversationHistory.length === 0 ? (
          <div className="text-center text-sm text-text-secondary py-8">
            No history available
          </div>
        ) : (
          <div className="space-y-3">
            {conversationHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg text-xs ${
                  msg.from === 'user'
                    ? 'bg-accent/10 text-text ml-auto max-w-[80%]'
                    : 'bg-panel text-text-secondary'
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
