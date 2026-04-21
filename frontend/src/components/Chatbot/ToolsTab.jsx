import { QuickActions } from './QuickActions';
import { ConversationHistory } from './ConversationHistory';

export default function ToolsTab({ onClear }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar px-3 py-3">
        <QuickActions embedded />
      </div>
      <div className="shrink-0 border-t border-[var(--border-default)] px-4 py-3 flex justify-between items-center gap-2 bg-[var(--surface-card)]">
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-[var(--status-critical)] hover:opacity-80"
          title="Clear conversation and start fresh"
        >
          Clear chat
        </button>
        <ConversationHistory />
      </div>
    </div>
  );
}
