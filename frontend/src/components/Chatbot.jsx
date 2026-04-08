import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
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
        parts.push(
          <code
            key={`${keyPrefix}-${key++}`}
            className="text-[13px] bg-black/[0.06] px-1.5 py-0.5 rounded-md font-mono text-[#1c1c1e]"
          >
            {m[0].slice(1, -1)}
          </code>
        );
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
      <div className="flex justify-center px-2 animate-[fadeIn_0.2s_ease-out]" role="listitem">
        <p className="max-w-[min(100%,20rem)] text-center text-[13px] leading-relaxed text-[#8e8e93] font-medium">
          {text.split(/\n/).filter(Boolean).map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      </div>
    );
  }
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-1 animate-[fadeIn_0.2s_ease-out]`} role="listitem">
      <div
        className={`max-w-[78%] rounded-[19px] px-3.5 py-2 text-[15px] leading-[1.35] tracking-[-0.01em] ${
          isUser ? 'bg-[#007aff] text-white' : 'bg-[#e9e9eb] text-[#1c1c1e]'
        }`}
      >
        {isUser ? (
          text.split('\n').map((line, idx) => (
            <p key={idx} className={idx > 0 ? 'mt-1.5' : ''}>
              {line}
            </p>
          ))
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
    <li className={isRisk ? 'bg-[#fff9f0]' : ''}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-left w-full flex items-center justify-between gap-3 py-3 px-4 min-h-[44px] text-[15px] font-normal text-[#1c1c1e] focus:outline-none focus-visible:bg-black/[0.03] active:bg-black/[0.04]"
        title={content || undefined}
      >
        <span className="truncate flex items-center gap-2 min-w-0">
          {isRisk && (
            <span className="shrink-0 size-2 rounded-full bg-[#ff9500]" aria-hidden title="Risk flags" />
          )}
          {title}
        </span>
        <span className="text-[#c7c7cc] text-lg font-extralight leading-none shrink-0 w-6 text-center" aria-hidden>
          {open ? '−' : '›'}
        </span>
      </button>
      {open && content && (
        <div className="px-4 pb-3 pt-0 text-[13px] text-[#636366] leading-relaxed border-t border-black/[0.06]">
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
    <div className="flex justify-start px-1 animate-[fadeIn_0.25s_ease-out]" aria-live="polite" aria-busy="true">
      <div className="inline-flex items-center gap-1.5 rounded-[19px] bg-[#e9e9eb] px-4 py-3">
        {[0, 0.15, 0.3].map((delay, idx) => (
          <span
            key={idx}
            className="h-1.5 w-1.5 rounded-full bg-[#aeaeb2] animate-bounce"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
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

const PANEL_CHAT = 'chat';
const PANEL_REPORT = 'report';
const PANEL_TOOLS = 'tools';

function mainPanelTabClass(active) {
  return `flex-1 min-w-0 py-0.5 px-1 sm:px-1.5 rounded-md text-[11px] sm:text-[12px] font-medium transition-[background,box-shadow,color] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]/35 focus-visible:ring-offset-0 ${
    active
      ? 'bg-white text-[#1c1c1e] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'text-[#8e8e93] hover:text-[#636366]'
  }`;
}

export default function Chatbot() {
  const [messages, setMessages] = useState(() => {
    const hist = useSceneStore.getState().conversationHistory;
    return hist.length > 0 ? hist : [createMessage('assistant', GREETING)];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [panelTab, setPanelTab] = useState(PANEL_CHAT);
  const [reportAnalyzeTick, setReportAnalyzeTick] = useState(0);
  const chatScrollRef = useRef(null);
  const lastReportKeyRef = useRef(null);

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
  const citedOrgans = useSceneStore((s) => s.citedOrgans);
  const citedOrganIndex = useSceneStore((s) => s.citedOrganIndex);
  const goToNextCitedOrgan = useSceneStore((s) => s.goToNextCitedOrgan);
  const goToPrevCitedOrgan = useSceneStore((s) => s.goToPrevCitedOrgan);





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
  }, [analyzedReport, reportAnalyzeTick, addMessage, setLastReply, applyCardsAndFocus, setAnalyzing]);


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
    setPanelTab(PANEL_CHAT);
  }, [resetStore]);

  const handleNewSessionClick = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Start a new conversation? Messages and the loaded report will be cleared.')
    ) {
      return;
    }
    handleNewSession();
  }, [handleNewSession]);

  /** New report text in store → reset thread so previous reports do not stay visible. */
  useLayoutEffect(() => {
    const key =
      typeof analyzedReport === 'string' && analyzedReport.trim()
        ? analyzedReport.trim()
        : '';
    if (lastReportKeyRef.current === null) {
      lastReportKeyRef.current = key;
      return;
    }
    if (lastReportKeyRef.current === key) return;
    lastReportKeyRef.current = key;
    if (key.length > 0) {
      setMessages([createMessage('assistant', GREETING)]);
    }
  }, [analyzedReport]);

  useLayoutEffect(() => {
    if (panelTab !== PANEL_CHAT) return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, lastCards, isLoading, lastError, panelTab]);



  const retryReportAnalysis = useCallback(() => {
    const report = useSceneStore.getState().analyzedReport;
    if (!report?.trim()) return;
    setLastError(null);
    setReportAnalyzeTick((t) => t + 1);
  }, []);



  const reportBadge =
    Boolean(analyzedReport) || lastCards.length > 0 || lastError === 'report';

  return (
    <div className="assistant-panel flex flex-col h-full min-h-0 relative bg-[#f2f2f7]">
      <header
        className="shrink-0 bg-white border-b border-black/[0.08] px-2 py-1.5 flex items-center gap-1.5 min-h-0"
        role="presentation"
      >
        <h2 className="text-[13px] font-semibold text-[#1c1c1e] tracking-tight shrink-0 pl-0.5">Assistant</h2>
        <div
          className="flex-1 min-w-0 flex p-[2px] rounded-lg bg-[#00000012] gap-0"
          role="tablist"
          aria-label="Assistant panels"
        >
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === PANEL_CHAT}
            onClick={() => setPanelTab(PANEL_CHAT)}
            className={mainPanelTabClass(panelTab === PANEL_CHAT)}
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === PANEL_REPORT}
            onClick={() => setPanelTab(PANEL_REPORT)}
            className={`${mainPanelTabClass(panelTab === PANEL_REPORT)} inline-flex items-center justify-center gap-1`}
          >
            <span>Report</span>
            {reportBadge && (
              <span
                className="inline-flex h-1 w-1 rounded-full bg-[#007aff]"
                title="Report or findings available"
                aria-hidden
              />
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === PANEL_TOOLS}
            onClick={() => setPanelTab(PANEL_TOOLS)}
            className={mainPanelTabClass(panelTab === PANEL_TOOLS)}
          >
            Tools
          </button>
        </div>
        <button
          type="button"
          onClick={handleNewSessionClick}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-[#007aff] hover:bg-[#007aff]/8 active:opacity-70"
          title="New conversation"
          aria-label="New conversation — clears messages and report"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </header>

      {panelTab === PANEL_CHAT && (
        <div className="flex flex-col flex-1 min-h-0">
          <div
            ref={chatScrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 assistant-scrollbar"
            role="log"
            aria-live="polite"
          >
            {lastError === 'connection' && (
              <div className="rounded-[10px] bg-white px-4 py-3 flex flex-col gap-3 border border-black/[0.06]">
                <p className="text-[15px] text-[#1c1c1e] leading-snug">
                  Could not reach the assistant. Check that the backend is running.
                </p>
                <button
                  type="button"
                  onClick={() => setLastError(null)}
                  className="self-start text-[17px] font-normal text-[#007aff] active:opacity-60"
                >
                  OK
                </button>
              </div>
            )}
            {lastError === 'report' && analyzedReport && (
              <div className="rounded-[10px] bg-white px-4 py-3 border border-black/[0.06]">
                <p className="text-[15px] text-[#1c1c1e] leading-snug mb-2">
                  Report analysis failed. Retry or keep chatting with the report in context.
                </p>
                <button
                  type="button"
                  onClick={retryReportAnalysis}
                  className="text-[17px] font-normal text-[#007aff] active:opacity-60"
                >
                  Retry
                </button>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                from={m.from}
                text={m.text}
                isGreeting={m.id === messages[0]?.id && m.from === 'assistant'}
              />
            ))}
            {lastCards.length > 0 && (
              <div className="pt-1">
                <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                  <span className="text-[12px] font-semibold text-[#8e8e93]">Findings</span>
                  {lastMeta?.cardsFrom === 'fallback' && (
                    <span
                      className="text-[10px] text-[#8e8e93] font-medium"
                      title="Cards were generated using local fallback (MCP unavailable)."
                    >
                      Local
                    </span>
                  )}
                </div>
                {citedOrgans.length > 1 && (
                  <div
                    className="flex items-center justify-center gap-2 py-1.5 mb-2 rounded-[10px] bg-white border border-black/[0.06]"
                    role="group"
                    aria-label="Navigate organs from report"
                  >
                    <button
                      type="button"
                      onClick={goToPrevCitedOrgan}
                      className="p-1.5 rounded-full text-[#007aff] active:opacity-50"
                      title="Previous organ"
                      aria-label="Previous organ"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                    <span className="text-[12px] font-medium text-[#8e8e93] tabular-nums min-w-[2.75rem] text-center">
                      {citedOrganIndex + 1} / {citedOrgans.length}
                    </span>
                    <button
                      type="button"
                      onClick={goToNextCitedOrgan}
                      className="p-1.5 rounded-full text-[#007aff] active:opacity-50"
                      title="Next organ"
                      aria-label="Next organ"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                )}
                <ul className="rounded-[10px] bg-white overflow-hidden border border-black/[0.06] divide-y divide-black/[0.08]">
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
              <p className="text-[12px] text-[#8e8e93] text-center px-2 py-2">
                Upload a report from the Report tab to see findings here.
              </p>
            )}
            {isLoading && <LoadingIndicator />}
            <div className="h-1 shrink-0" aria-hidden />
          </div>

          <form
            onSubmit={sendMessage}
            className="shrink-0 bg-white border-t border-black/[0.08] px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0))]"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">
                Message
              </label>
              <input
                id="chat-input"
                className="flex-1 min-w-0 rounded-[20px] bg-[#f2f2f7] px-4 py-2.5 text-[15px] text-[#1c1c1e] placeholder:text-[#8e8e93] border-0 focus:outline-none focus:ring-0 disabled:opacity-50"
                placeholder="Message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                aria-describedby={lastError ? 'chat-error' : undefined}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="cta-analyze shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#007aff] text-white disabled:opacity-35 disabled:cursor-not-allowed"
                aria-label="Send"
              >
                {isLoading ? (
                  <span className="text-lg leading-none opacity-80">…</span>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-0.5">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {panelTab === PANEL_REPORT && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 assistant-scrollbar">
            <ReportInput embedded />
          </div>
        </div>
      )}

      {panelTab === PANEL_TOOLS && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
          <div className="flex-1 min-h-0 overflow-y-auto assistant-scrollbar px-3 py-3">
            <QuickActions embedded />
          </div>
          <div className="shrink-0 border-t border-black/[0.08] px-4 py-3 flex justify-between items-center gap-2 bg-white">
            <button
              type="button"
              onClick={handleNewSessionClick}
              className="text-[17px] font-normal text-[#ff3b30] active:opacity-60"
              title="Clear conversation and start fresh"
            >
              Clear chat
            </button>
            <ConversationHistory />
          </div>
        </div>
      )}

      {lastError && (
        <p id="chat-error" className="sr-only" role="alert">
          An error occurred. Use Retry to try again.
        </p>
      )}
    </div>
  );
}


