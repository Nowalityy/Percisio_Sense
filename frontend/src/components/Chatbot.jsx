import { useState, useEffect, useCallback } from 'react';
import { useSceneStore } from '../store.js';
import { focusOnOrgan } from '../utils/viewerUtils.js';
import { cardTitleToFocusKey, getSegmentNamesForFocus } from '../components/Viewer3D/focusUtils.js';
import { QuickActions } from './Chatbot/QuickActions';
import { ConversationHistory } from './Chatbot/ConversationHistory';
import { ReportInput } from './Chatbot/ReportInput';

const DEFAULT_BACKEND_URL = 'http://localhost:4000/chat';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL;



const AUTO_SUMMARY_PROMPT_PREFIX =
  '[SYSTEM]: A new medical document has been uploaded. Provide a professional clinical summary. Focus on significant findings and provide a clinical impression. Use headers: Findings, Impression, Recommendations.\n\n[DOCUMENT CONTENT]:\n';
const CONTEXT_PROMPT_TEMPLATE =
  '[CONTEXT - ANALYZED DOCUMENT]:\n{report}\n\n---\n\n[USER INQUIRY]:\n{question}';

const FALLBACK_REPLY_SUMMARY = "I received the document, but I cannot summarize it.";
const FALLBACK_REPLY_EMPTY = '(no response)';
const ERROR_REPORT_ANALYSIS =
  'Automatic document analysis failed. You can still ask questions about the report—your questions will include the report as context. Try again below if the backend is available.';
const ERROR_CONNECTION =
  "Could not reach the assistant. Check that the backend is running (e.g. http://localhost:4000) and try again.";
const GREETING =
  "Clinical AI is ready.\nUpload a report or request a targeted analysis.";

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

function MessageBubble({ from, text, isGreeting }) {
  const isUser = from === 'user';
  if (isGreeting) {
    return (
      <div className="flex justify-start animate-[fadeIn_0.2s_ease-out]" role="listitem">
        <div className="text-sm text-slate-600 leading-relaxed space-y-1">
          {text.split(/\n/).filter(Boolean).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.2s_ease-out]`} role="listitem">
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed transition-shadow duration-200 ${
          isUser
            ? 'bg-accent text-white border border-accent/60 shadow-md hover:shadow-lg'
            : 'bg-slate-100 border border-border text-text shadow-sm hover:shadow-md'
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
    <div className="flex justify-start animate-[fadeIn_0.25s_ease-out]" aria-live="polite" aria-busy="true">
      <div className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm flex items-center gap-2 bg-white">
        {[0, 0.15, 0.3].map((delay, idx) => (
          <span
            key={idx}
            className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
        <span className="text-text-secondary text-xs font-medium">Analyzing…</span>
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
  const [messages, setMessages] = useState(() => {
    const hist = useSceneStore.getState().conversationHistory;
    return hist.length > 0 ? hist : [createMessage('assistant', GREETING)];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState(null);


  const setFocus = useSceneStore((s) => s.setFocus);
  const clearFocus = useSceneStore((s) => s.clearFocus);
  const setCitedOrgans = useSceneStore((s) => s.setCitedOrgans);
  const setCitedOrganIndex = useSceneStore((s) => s.setCitedOrganIndex);
  const setLastReply = useSceneStore((s) => s.setLastReply);
  const analyzedReport = useSceneStore((s) => s.analyzedReport);
  const addToConversationHistory = useSceneStore((s) => s.addToConversationHistory);
  const setAnalyzing = useSceneStore((s) => s.setAnalyzing);
  const resetStore = useSceneStore((s) => s.resetStore);
  const lastCards = useSceneStore((s) => s.lastCards);
  const setLastCards = useSceneStore((s) => s.setLastCards);
  const lastMeta = useSceneStore((s) => s.lastMeta);
  const setLastMeta = useSceneStore((s) => s.setLastMeta);





  const handleFocus = useCallback(
    (focus) => {
      if (focus) {
        setFocus(focus);
        focusOnOrgan(focus);
      }
    },
    [setFocus]
  );

  /** Build list of focus keys from report cards and sync store + camera. Only use keys that match at least one segment. */
  const applyCardsAndFocus = useCallback(
    (cards, uiActions) => {
      const organCards = (cards || []).filter((c) => c?.id !== 'card-risks');
      const rawKeys = [
        ...new Set(
          organCards
            .map((c) => cardTitleToFocusKey(c?.title))
            .filter(Boolean)
        ),
      ];
      const keys = rawKeys.filter((key) => getSegmentNamesForFocus(key).length > 0);
      setCitedOrgans(keys);
      if (keys.length > 0) {
        setFocus(keys[0]);
        focusOnOrgan(keys[0]);
      } else {
        clearFocus();
      }
      if (Array.isArray(uiActions)) {
        for (const action of uiActions) {
          if (action?.type === 'FOCUS_ORGAN' && action.organ && getSegmentNamesForFocus(action.organ).length > 0) {
            handleFocus(action.organ);
          }
        }
      }
      if (keys.length > 0) {
        const focusActions = (uiActions || []).filter(
          (a) => a?.type === 'FOCUS_ORGAN' && a.organ && getSegmentNamesForFocus(a.organ).length > 0
        );
        const lastFocus = focusActions.length
          ? focusActions[focusActions.length - 1].organ
          : keys[0];
        const idx = keys.indexOf(lastFocus);
        if (idx >= 0) setCitedOrganIndex(idx);
      }
    },
    [setCitedOrgans, setFocus, setCitedOrganIndex, handleFocus, clearFocus]
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
      setAnalyzing(true);
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
        applyCardsAndFocus(data?.cards ?? [], data?.uiActions ?? []);
      } catch (err) {
        console.error(err);
        setLastError('report');
        addMessage('assistant', ERROR_REPORT_ANALYSIS);
        setLastCards([]);
        setLastMeta(null);
      } finally {
        setIsLoading(false);
        setAnalyzing(false);
      }
    };

    autoSummarize();
  }, [analyzedReport, addMessage, setLastReply, applyCardsAndFocus, setAnalyzing]);


  const sendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = input.trim();

    if (!trimmed || isLoading) {
      return;
    }

    addMessage('user', input);
    setInput('');
    setIsLoading(true);
    setAnalyzing(true);

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
      applyCardsAndFocus(data?.cards ?? [], data?.uiActions ?? []);
    } catch (err) {
      console.error(err);
      setLastError('connection');
      addMessage('assistant', ERROR_CONNECTION);
      setLastCards([]);
      setLastMeta(null);
    } finally {
      setIsLoading(false);
      setAnalyzing(false);
    }
  };

  const handleNewSession = useCallback(() => {
    resetStore();
    setMessages([createMessage('assistant', GREETING)]);
  }, [resetStore]);



  const retryReportAnalysis = useCallback(() => {
    const report = useSceneStore.getState().analyzedReport;
    if (report) useSceneStore.getState().setAnalyzedReport(report);
    setLastError(null);
  }, []);



  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Bloc titre + Add report / AI ready — padding réduit sur mobile pour moins de densité */}
      <div className="border-b border-[#E5E7EB] shrink-0 flex flex-col gap-1.5 md:gap-2 px-4 md:px-5 pt-2.5 md:pt-3 pb-2.5 md:pb-3">
        <h2 className="text-sm font-bold text-text tracking-tight">Clinical AI Analysis</h2>
        <p className="text-xs text-slate-500 hidden sm:block">Extract insights from patient scans in seconds</p>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 pt-0.5 md:pt-1">
          <ReportInput />
        </div>
        <div className="flex justify-between items-center mt-auto">
          <button
            type="button"
            onClick={handleNewSession}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-accent transition-colors flex items-center gap-1.5"
            title="Clear persistent conversation and start fresh"
          >
            <span className="text-sm">↺</span> New Session
          </button>
          <ConversationHistory />
        </div>
      </div>

      <div className="px-4 md:px-5 py-2 md:py-2.5 border-b border-[#E5E7EB] shrink-0 bg-white">
        <QuickActions />
      </div>
      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-3 md:py-4 space-y-3 md:space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" role="log" aria-live="polite">
        {lastError === 'report' && analyzedReport && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
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
          <MessageBubble key={m.id} from={m.from} text={m.text} isGreeting={m.id === messages[0]?.id && m.from === 'assistant'} />
        ))}
        {lastCards.length > 0 && (
          <div className="rounded-lg border border-[#E5E7EB] p-4 space-y-3">
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
          <div className="rounded-lg border border-dashed border-[#E5E7EB] px-4 py-3">
            <p className="text-sm text-slate-500">
              Upload a report to display findings by organ.
            </p>
          </div>
        )}
        {isLoading && <LoadingIndicator />}
      </div>

      <form
        onSubmit={sendMessage}
        className="border-t border-[#E5E7EB] px-4 md:px-5 py-2.5 md:py-3 flex flex-nowrap items-center gap-2 md:gap-3 bg-white shrink-0 pb-[env(safe-area-inset-bottom,0)]"
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask a question
        </label>
        <input
          id="chat-input"
          className="flex-1 min-w-0 glass-input rounded-md px-3 md:px-4 py-2 md:py-2.5 text-base md:text-sm text-text placeholder:text-text-secondary transition-all duration-200 focus:ring-2 focus:ring-accent/20"
          placeholder="Ask about abnormalities, measurements, or risk indicators…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          aria-describedby={lastError ? 'chat-error' : undefined}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="cta-analyze px-4 md:px-5 py-2 md:py-2.5 rounded-md text-sm font-semibold bg-accent/95 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all duration-200 shrink-0 min-w-[6.5rem]"
          aria-label="Analyze scan"
        >
          {isLoading ? '...' : 'Analyze Scan'}
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


