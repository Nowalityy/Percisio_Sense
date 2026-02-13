import { useState, useEffect, useCallback } from 'react';
import { useSceneStore } from '../store.js';
import { focusOnOrgan } from '../utils/viewerUtils.js';
import { QuickActions } from './Chatbot/QuickActions';
import { ConversationHistory } from './Chatbot/ConversationHistory';
import { ReportInput } from './Chatbot/ReportInput';

const DEFAULT_BACKEND_URL = 'http://localhost:4000/chat';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL;

const AUTO_SUMMARY_PROMPT_PREFIX =
  '[SYSTEM]: A new medical document has been uploaded. Analyze it in depth. Provide a complete summary, list anomalies by organ, and conclude with a probable diagnosis or recommendations.\n\n[DOCUMENT]:\n';
const CONTEXT_PROMPT_TEMPLATE =
  '[CONTEXT - ANALYZED DOCUMENT]:\n{report}\n\n[USER QUESTION]:\n{question}';

const FALLBACK_REPLY_SUMMARY = "I received the document, but I cannot summarize it.";
const FALLBACK_REPLY_EMPTY = '(no response)';
const ERROR_REPORT_ANALYSIS =
  'Automatic document analysis failed. You can still ask questions about the report—your questions will include the report as context. Try again below if the backend is available.';
const ERROR_CONNECTION =
  "Could not reach the assistant. Check that the backend is running (e.g. http://localhost:4000) and try again.";
const GREETING =
  "Hello, I'm your AI assistant.\nAsk me a question about the scan or upload a report for me to analyze.";

/** Minimal markdown: **bold**, `code`, newlines. Renders as React nodes. */
function SimpleMarkdown({ text }) {
  const parseLine = (line, keyPrefix) => {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0;
    let key = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > lastIndex) {
        parts.push(<span key={`${keyPrefix}-${key++}`}>{line.slice(lastIndex, m.index)}</span>);
      }
      if (m[0].startsWith('**')) {
        parts.push(<strong key={`${keyPrefix}-${key++}`}>{m[0].slice(2, -2)}</strong>);
      } else {
        parts.push(<code key={`${keyPrefix}-${key++}`} className="text-xs glass-input px-1.5 py-0.5 rounded-lg">{m[0].slice(1, -1)}</code>);
      }
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(<span key={`${keyPrefix}-${key++}`}>{line.slice(lastIndex)}</span>);
    }
    return parts.length ? parts : [line];
  };

  return (
    <div className="[&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_strong]:font-semibold">
      {text.split('\n').map((line, i) => (
        <p key={i}>{parseLine(line, i)}</p>
      ))}
    </div>
  );
}

function MessageBubble({ from, text }) {
  const isUser = from === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} role="listitem">
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-accent text-white border border-accent/60 shadow-md'
            : 'bg-slate-100 border border-border text-text shadow-sm'
        }`}
      >
        {isUser ? (
          text.split('\n').map((line, idx) => <p key={idx}>{line}</p>)
        ) : (
          <SimpleMarkdown text={text} />
        )}
      </div>
    </div>
  );
}

function CardItem({ card, isRisk = false }) {
  const title = card?.title ?? '';
  const content = card?.content ?? card?.text ?? '';
  const [open, setOpen] = useState(false);
  const lines = content ? content.trim().split(/\r?\n/) : [];
  const bulletLines = lines.filter((l) => l.startsWith('- '));
  const isBulletList = bulletLines.length > 0 && bulletLines.length >= lines.length * 0.5;

  return (
    <li
      className={`border-b border-border/50 pb-3 last:border-0 last:pb-0 ${isRisk ? 'pl-3 border-l-4 border-l-amber-500 bg-amber-50/40 rounded-r-md -mx-0.5' : ''}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-left w-full font-medium text-text flex items-center justify-between gap-2 py-0.5"
        title={content || undefined}
      >
        <span className="truncate flex items-center gap-1.5">
          {isRisk && (
            <span className="shrink-0 text-amber-600" aria-hidden="true" title="Risk flags">
              ⚠
            </span>
          )}
          {title}
        </span>
        <span className="text-text-secondary shrink-0">{open ? '−' : '+'}</span>
      </button>
      {open && content && (
        <div className="mt-2 text-xs text-text-secondary space-y-1">
          {isBulletList ? (
            <ul className="list-disc list-inside space-y-0.5 pl-0.5">
              {bulletLines.map((line, i) => (
                <li key={i} className="leading-relaxed">
                  {line.slice(2).trim() || line}
                </li>
              ))}
            </ul>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">
              {content}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex justify-start" aria-live="polite" aria-busy="true">
      <div className="bg-slate-100 border border-border rounded-2xl px-3 py-2 text-sm flex items-center gap-2 shadow-sm">
        {[0, 0.15, 0.3].map((delay, idx) => (
          <span
            key={idx}
            className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
        <span className="text-text-secondary text-xs">Analyzing…</span>
      </div>
    </div>
  );
}

let messageIdCounter = 0;
function createMessage(from, text) {
  messageIdCounter += 1;
  return {
    id: messageIdCounter,
    from,
    text,
  };
}

async function sendChatRequest(message, reportText = null) {
  const body = { message };
  const raw = reportText != null && typeof reportText === 'string' ? reportText.trim() : '';
  if (raw.length > 0) {
    body.reportText = raw;
  }
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function buildMessageWithContext(userMessage, analyzedReport) {
  if (!analyzedReport) {
    return userMessage;
  }

  return CONTEXT_PROMPT_TEMPLATE.replace('{report}', analyzedReport).replace('{question}', userMessage);
}

export default function Chatbot() {
  const [messages, setMessages] = useState([createMessage('assistant', GREETING)]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [lastCards, setLastCards] = useState([]);
  const [lastMeta, setLastMeta] = useState(null);

  const setFocus = useSceneStore((s) => s.setFocus);
  const setLastReply = useSceneStore((s) => s.setLastReply);
  const analyzedReport = useSceneStore((s) => s.analyzedReport);
  const addToConversationHistory = useSceneStore((s) => s.addToConversationHistory);

  const handleFocus = useCallback(
    (focus) => {
      if (focus) {
        setFocus(focus);
        focusOnOrgan(focus);
      }
    },
    [setFocus]
  );

  const runUiActions = useCallback(
    (uiActions) => {
      if (!Array.isArray(uiActions)) return;
      for (const action of uiActions) {
        if (action?.type === 'FOCUS_ORGAN' && action.organ) {
          handleFocus(action.organ);
        }
        // TOGGLE_LAYER can be wired later if needed
      }
    },
    [handleFocus]
  );

  const addMessage = useCallback(
    (from, text) => {
      const message = createMessage(from, text);
      setMessages((prev) => [...prev, message]);
      addToConversationHistory(message);
    },
    [addToConversationHistory]
  );

  useEffect(() => {
    if (!analyzedReport) {
      return;
    }

    const autoSummarize = async () => {
      setIsLoading(true);
      setLastError(null);
      const prompt = AUTO_SUMMARY_PROMPT_PREFIX + analyzedReport;

      try {
        const reportPayload =
          typeof analyzedReport === 'string' && analyzedReport.trim().length > 0
            ? analyzedReport.trim()
            : null;
        const data = await sendChatRequest(prompt, reportPayload);
        const answer = data?.answer ?? data?.reply ?? FALLBACK_REPLY_SUMMARY;
        addMessage('assistant', answer);
        setLastReply(answer);
        setLastCards(Array.isArray(data?.cards) ? data.cards : []);
        setLastMeta(data?._meta ?? null);
        runUiActions(data?.uiActions);
      } catch (err) {
        console.error(err);
        setLastError('report');
        addMessage('assistant', ERROR_REPORT_ANALYSIS);
        setLastCards([]);
        setLastMeta(null);
      } finally {
        setIsLoading(false);
      }
    };

    autoSummarize();
  }, [analyzedReport, addMessage, setLastReply, runUiActions]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = input.trim();

    if (!trimmed || isLoading) {
      return;
    }

    addMessage('user', input);
    setInput('');
    setIsLoading(true);

    // Do not clear focus on send — keeps camera stable; user can use "Reset view" in 3D to recenter

    const messageToSend = buildMessageWithContext(trimmed, analyzedReport);

    setLastError(null);
    try {
      const reportPayload =
        typeof analyzedReport === 'string' && analyzedReport.trim().length > 0
          ? analyzedReport.trim()
          : null;
      const data = await sendChatRequest(messageToSend, reportPayload);
      const answer = data?.answer ?? data?.reply ?? FALLBACK_REPLY_EMPTY;
      const hasFocusOnlyAction =
        Array.isArray(data?.uiActions) &&
        data.uiActions.some((a) => a?.type === 'FOCUS_ORGAN' && a.organ);
      const isEmptyReply = typeof answer === 'string' && !answer.trim();
      if (!(hasFocusOnlyAction && isEmptyReply)) {
        addMessage('assistant', answer);
      }
      setLastReply(answer);
      setLastCards(Array.isArray(data?.cards) ? data.cards : []);
      setLastMeta(data?._meta ?? null);
      runUiActions(data?.uiActions);
    } catch (err) {
      console.error(err);
      setLastError('connection');
      addMessage('assistant', ERROR_CONNECTION);
      setLastCards([]);
      setLastMeta(null);
    } finally {
      setIsLoading(false);
    }
  };

  const retryReportAnalysis = useCallback(() => {
    const report = useSceneStore.getState().analyzedReport;
    if (report) useSceneStore.getState().setAnalyzedReport(report);
    setLastError(null);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="border-b border-border shrink-0 flex flex-col gap-2 px-3 pt-2 pb-2">
        <div>
          <ReportInput />
        </div>
        <div className="flex justify-end">
          <ConversationHistory />
        </div>
      </div>
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 bg-slate-50 shrink-0">
        <QuickActions />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" role="log" aria-live="polite">
        {lastError === 'report' && analyzedReport && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-amber-800">
              Report analysis failed. You can retry or keep asking questions with the report in context.
            </p>
            <button
              type="button"
              onClick={retryReportAnalysis}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-200 text-amber-900 hover:bg-amber-300 transition-colors shrink-0"
            >
              Retry analysis
            </button>
          </div>
        )}
        {lastError === 'connection' && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-red-800">
              Could not reach the assistant. Check that the backend is running and try again.
            </p>
            <button
              type="button"
              onClick={() => setLastError(null)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-200 text-red-900 hover:bg-red-300 transition-colors shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} from={m.from} text={m.text} />
        ))}
        {lastCards.length > 0 && (
          <div className="rounded-xl border border-border bg-slate-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Findings by organ
                {(() => {
                  const findingsCount = lastCards.filter((c) => c.id !== 'card-risks').length;
                  if (findingsCount > 0) return ` (${findingsCount})`;
                  return '';
                })()}
              </span>
              {lastMeta?.cardsFrom === 'fallback' && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium"
                  title="Cards were generated using local fallback (MCP unavailable)."
                >
                  Local summary
                </span>
              )}
            </div>
            <ul className="text-sm text-text space-y-1">
              {lastCards.map((c) => (
                <CardItem
                  key={c.id ?? c.title ?? c.content}
                  card={c}
                  isRisk={c.id === 'card-risks'}
                />
              ))}
            </ul>
          </div>
        )}
        {!analyzedReport && lastCards.length === 0 && !isLoading && (
          <div className="rounded-xl border border-dashed border-border bg-slate-50/60 px-4 py-3">
            <p className="text-sm text-text-secondary">
              Upload a report to display findings by organ.
            </p>
          </div>
        )}
        {isLoading && <LoadingIndicator />}
      </div>

      <form onSubmit={sendMessage} className="border-t border-border px-3 py-2 flex items-center gap-2 bg-slate-50">
        <label htmlFor="chat-input" className="sr-only">
          Ask a question
        </label>
        <input
          id="chat-input"
          className="flex-1 glass-input rounded-full px-3 py-2 text-base md:text-sm text-text placeholder:text-text-secondary"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          aria-describedby={lastError ? 'chat-error' : undefined}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-3 md:px-4 py-2 rounded-full text-sm font-medium bg-accent text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90 shrink-0 shadow-sm"
          aria-label="Send message"
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
      {lastError && (
        <p id="chat-error" className="sr-only" role="alert">
          An error occurred. Use Retry to try again.
        </p>
      )}
    </div>
  );
}
