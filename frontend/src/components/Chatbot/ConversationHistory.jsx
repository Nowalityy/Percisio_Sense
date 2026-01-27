import { useState } from 'react';
import { useSceneStore } from '../../store';

export function ConversationHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const conversationHistory = useSceneStore((s) => s.conversationHistory);
  const clearConversationHistory = useSceneStore((s) => s.clearConversationHistory);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-2 right-2 z-10 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        title="Historique"
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
    <div className="absolute inset-0 z-20 bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Historique des conversations</h3>
        <div className="flex items-center gap-2">
          {conversationHistory.length > 0 && (
            <button
              onClick={clearConversationHistory}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Effacer
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
          <div className="text-center text-sm text-gray-500 py-8">
            Aucun historique disponible
          </div>
        ) : (
          <div className="space-y-3">
            {conversationHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg text-xs ${
                  msg.from === 'user'
                    ? 'bg-accent/10 text-gray-800 ml-auto max-w-[80%]'
                    : 'bg-gray-100 text-gray-700'
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
