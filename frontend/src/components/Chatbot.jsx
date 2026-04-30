import { lazy, memo, Suspense, useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { List as VirtualList } from 'react-window';
import { useSceneStore } from '../store.js';
import {
  cardTitleToFocusKey,
  getSegmentNamesForFocus,
  isFocusKeyAvailableInCurrentModel,
} from '../components/Viewer3D/focusUtils.js';
import { extractVertebraFocusFromPlainText, ZOOM_OR_VIEW_INTENT } from '../viewer-core/vertebraIntent';
import { CHAT_URL } from '../config/api.js';
import { PERFORMANCE_CONFIG } from '../performance.config';
import { useLeakDetector } from '../hooks/useLeakDetector';
import { SkeletonPanel } from './SkeletonPanel.jsx';

const ToolsTab = lazy(() => import('./Chatbot/ToolsTab.jsx'));

const AUTO_SUMMARY_PROMPT_PREFIX =
  '[SYSTEM]: A new imaging report has been uploaded to the workspace.\n\n' +
  'Your task:\n' +
  '- Produce a concise, professional clinical summary using these headings: **Findings**, **Impression**, **Recommendations**.\n' +
  '- Open with exactly one short sentence that frames the answer as a quick review of the scan report. ' +
  'Example: "Following a focused review of the imaging report, here is a structured summary." ' +
  'Write the opening line and the **entire** summary in **English**, even if the source document is in another language.\n' +
  '- Summarize and interpret only; do not paste or reproduce lengthy verbatim excerpts of the source.\n\n' +
  '[DOCUMENT CONTENT]:\n';
const CONTEXT_PROMPT_TEMPLATE =
  '[CONTEXT - ANALYZED DOCUMENT]:\n{report}\n\n---\n\n' +
  'Instructions: Answer using this document as the source. **Reply in English.** Do not repeat or paste the full report; use synthesis and short structured sections as appropriate.\n\n' +
  '[USER INQUIRY]:\n{question}';

const FALLBACK_REPLY_SUMMARY = "I received the document, but I cannot summarize it.";
const FALLBACK_REPLY_EMPTY = '(no response)';
const ERROR_REPORT_ANALYSIS =
  'Automatic document analysis failed. You can still ask questions about the report—your questions will include the report as context. Try again below if the backend is available.';
const ERROR_CONNECTION =
  "Could not reach the assistant. Check that the backend is running (e.g. http://localhost:4000) and try again.";
/** Shown when the model tries to focus a structure that this scan / segment set does not include. */
const ERROR_FOCUS_STRUCTURE_UNAVAILABLE = (label) =>
  `**${label}** is not available in the current 3D model. This export may not include that organ or bone — try another structure or switch the study if your dataset supports it.`;
const GREETING =
  "Percisio AI is ready.\nUpload a report or request a targeted analysis.";
const QUICK_ACTION_CHIPS = ['Summarize findings', 'Flag anomalies', 'Generate report'];
const STREAMING_TYPING_DELAY_MS = 200;

const SEVERITY_PATTERNS = [
  { level: 'critical', test: /(critical|urgent|severe|life-threatening)/i, color: 'bg-red-400/20 text-red-200 border-red-300/35 critical-pulse' },
  { level: 'moderate', test: /(moderate|concerning|attention)/i, color: 'bg-amber-400/20 text-amber-100 border-amber-300/35' },
  { level: 'mild', test: /(mild|minor|low)/i, color: 'bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)] border-[var(--border-brand)]' }, // BRAND: #62C5EF
  { level: 'normal', test: /(normal|stable|unremarkable)/i, color: 'bg-emerald-400/15 text-emerald-100 border-emerald-300/30' },
];

const anatomyRegex = /\b(heart|liver|lungs?|aorta|vessels?|thyroid|pancreas|spleen|stomach|esophagus|trachea|kidneys?)\b/gi;

const responseCache = new Map();

function pruneResponseCache() {
  if (responseCache.size <= PERFORMANCE_CONFIG.API_CACHE_MAX_ENTRIES) return;
  const firstKey = responseCache.keys().next().value;
  if (firstKey) {
    responseCache.delete(firstKey);
  }
}

function hashPrompt(prompt) {
  let hash = 0;
  for (let i = 0; i < prompt.length; i += 1) {
    hash = (hash << 5) - hash + prompt.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

/** Minimal markdown: **bold**, `code`, newlines. Renders as React nodes. */
const SimpleMarkdown = memo(function SimpleMarkdown({ text }) {
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

  const highlightAnatomy = (item, idx) => {
    if (typeof item !== 'string') return item;
    const chunks = item.split(anatomyRegex);
    return chunks.map((chunk, i) => {
      if (anatomyRegex.test(chunk)) {
        anatomyRegex.lastIndex = 0;
        return (
          <span
            key={`${idx}-${i}`}
            className="rounded-md bg-[var(--brand-primary-light)] px-1 py-0.5 text-[var(--brand-primary-dark)] border border-[var(--border-brand)]" // BRAND: #62C5EF
          >
            {chunk}
          </span>
        );
      }
      anatomyRegex.lastIndex = 0;
      return <span key={`${idx}-${i}`}>{chunk}</span>;
    });
  };

  return (
    <div className="[&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_strong]:font-semibold text-sm leading-relaxed">
      {text.split('\n').map((line, i) => (
        <p key={i}>
          {parseLine(line, i).map((token, idx) =>
            typeof token === 'string'
              ? highlightAnatomy(token, idx)
              : token
          )}
        </p>
      ))}
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({ from, text, isGreeting }) {
  const isUser = from === 'user';
  if (isGreeting) {
    return (
      <div className="h-full min-h-[260px] flex items-center justify-center px-4" role="listitem">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-[19rem]"
        >
          <div className="mx-auto size-14 rounded-2xl border border-[var(--border-brand)] bg-[var(--brand-primary-light)] grid place-items-center mb-4 animate-pulse"> {/* BRAND: #62C5EF */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--brand-primary-dark)]"> {/* BRAND: #62C5EF */}
              <path d="M3 12h5l2-6 4 12 2-6h5" strokeWidth="1.7" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" strokeWidth="1.4" opacity="0.4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text">Percisio AI Ready</h3>
          <p className="mt-1 text-sm text-text-secondary">Upload a report or request a targeted analysis</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-1`} role="listitem">
      <div
        className={`max-w-[83%] rounded-2xl px-3.5 py-2.5 text-sm leading-[1.45] tracking-[-0.005em] border ${
          isUser
            ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)] border-[var(--border-brand)]'
            : 'bg-white/5 text-text border-white/10'
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
});

const CardItem = memo(function CardItem({ card, isRisk = false, forceCollapsed = false }) {
  const title = card?.title ?? '';
  const content = card?.content ?? card?.text ?? '';
  const [open, setOpen] = useState(false);
  const lines = content ? content.trim().split(/\r?\n/) : [];
  const bulletLines = lines.filter((l) => l.startsWith('- '));
  const isBulletList = bulletLines.length > 0 && bulletLines.length >= lines.length * 0.5;
  const severity = useMemo(() => {
    const probe = `${title} ${content}`;
    return SEVERITY_PATTERNS.find((entry) => entry.test.test(probe)) ?? { level: isRisk ? 'moderate' : 'normal', color: isRisk ? 'bg-amber-400/20 text-amber-100 border-amber-300/35' : 'bg-emerald-400/15 text-emerald-100 border-emerald-300/30' };
  }, [title, content, isRisk]);

  return (
    <li className={`rounded-xl border ${isRisk ? 'border-amber-200/25' : 'border-white/10'} bg-white/[0.03]`}>
      <button
        type="button"
        onClick={() => {
          if (forceCollapsed) return;
          setOpen((o) => !o);
        }}
        className="text-left w-full flex items-center justify-between gap-3 py-3 px-4 min-h-[44px] text-sm font-medium text-text focus:outline-none"
        title={content || undefined}
      >
        <span className="truncate flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border ${severity.color}`}>
            {severity.level}
          </span>
          <span className="truncate">{title}</span>
        </span>
        <span className="text-slate-400 text-lg font-extralight leading-none shrink-0 w-6 text-center" aria-hidden>
          {forceCollapsed ? '•' : open ? '−' : '›'}
        </span>
      </button>
      {open && content && !forceCollapsed && (
        <div className="px-4 pb-3 pt-0 text-[13px] text-text-secondary leading-relaxed border-t border-white/10">
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
});

const LoadingIndicator = memo(function LoadingIndicator() {
  return (
    <div className="flex justify-start px-1" aria-live="polite" aria-busy="true">
      <div className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--brand-primary-light)] border border-[var(--border-brand)] px-4 py-3"> {/* BRAND: #62C5EF */}
        {[0, 0.15, 0.3].map((delay, idx) => (
          <span
            key={idx}
            className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)] animate-bounce" // BRAND: #62C5EF
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
    </div>
  );
});

const FindingsRow = memo(function FindingsRow({ index, style, cards }) {
  const card = cards[index];
  return (
    <div style={style} className="px-1 py-1">
      <CardItem card={card} isRisk={card?.id === 'card-risks'} forceCollapsed />
    </div>
  );
});

let messageIdCounter = 0;
function createMessage(from, text) {
  messageIdCounter += 1;
  return {
    id: messageIdCounter,
    from,
    text,
  };
}

const MAX_LLM_TURNS = 24;

function trimLlmTurns(ref) {
  if (ref.current.length > MAX_LLM_TURNS) {
    ref.current = ref.current.slice(-MAX_LLM_TURNS);
  }
}

async function sendChatRequest(
  message,
  reportText = null,
  { signal, onStreamChunk, history } = {}
) {
  const body = {
    message,
    // PERF: Request streaming responses when backend supports it.
    stream: true,
  };
  if (Array.isArray(history) && history.length > 0) {
    body.history = history;
  }
  const raw = reportText != null && typeof reportText === 'string' ? reportText.trim() : '';
  if (raw.length > 0) {
    body.reportText = raw;
  }

  const useClientCache = !history?.length;
  const cacheKey = useClientCache ? hashPrompt(`${message}::${raw}`) : null;
  if (useClientCache && cacheKey != null) {
    const cacheHit = responseCache.get(cacheKey);
    if (cacheHit && Date.now() - cacheHit.timestamp < PERFORMANCE_CONFIG.API_CACHE_TTL_MS) {
      return { ...cacheHit.payload, _fromCache: true };
    }
  }

  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  let payload = null;

  if (response.body && !contentType.includes('application/json')) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamedText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamedText += decoder.decode(value, { stream: true });
      onStreamChunk?.(streamedText);
    }
    streamedText += decoder.decode();
    payload = { answer: streamedText };
  } else {
    payload = await response.json();
  }

  if (useClientCache && cacheKey != null) {
    responseCache.set(cacheKey, { timestamp: Date.now(), payload });
    pruneResponseCache();
  }
  return payload;
}



function buildMessageWithContext(userMessage, analyzedReport) {
  if (!analyzedReport) {
    return userMessage;
  }

  return CONTEXT_PROMPT_TEMPLATE.replace('{report}', analyzedReport).replace('{question}', userMessage);
}

const PANEL_CHAT = 'chat';
const PANEL_TOOLS = 'tools';
const panelVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

function mainPanelTabClass(active) {
  return `relative flex-1 min-w-0 py-1.5 px-2 rounded-full text-xs font-medium transition-all duration-200 border-b-2 ${
    active
      ? 'text-[var(--text-on-brand)] bg-[var(--brand-primary)] border-[var(--brand-primary)] shadow-[var(--shadow-md)]' // BRAND: #62C5EF
      : 'text-text-secondary hover:text-text border-transparent'
  }`;
}

export default function Chatbot() {
  const [messages, setMessages] = useState(() => {
    const hist = useSceneStore.getState().conversationHistory;
    return hist.length > 0 ? hist : [createMessage('assistant', GREETING)];
  });
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [queuedRequests, setQueuedRequests] = useState(0);
  const [lastResponseFromCache, setLastResponseFromCache] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [panelTab, setPanelTab] = useState(PANEL_CHAT);
  const [reportAnalyzeTick, setReportAnalyzeTick] = useState(0);
  const chatScrollRef = useRef(null);
  const lastReportKeyRef = useRef(null);
  const llmTurnsRef = useRef([]);
  const reportExtractDoneFpRef = useRef(null);
  const requestQueueRef = useRef(Promise.resolve());
  const activeAbortRef = useRef(null);
  const typingTimerRef = useRef(null);
  const requestIdRef = useRef(0);
  useLeakDetector('Chatbot.scrollContainer', chatScrollRef);

  const setFocus = useSceneStore((s) => s.setFocus);
  const clearFocus = useSceneStore((s) => s.clearFocus);
  const clearCameraFocus = useSceneStore((s) => s.clearCameraFocus);
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
      }
    },
    [setFocus]
  );

  /**
   * Build list of focus keys from report cards and sync store + camera.
   * Only use keys that match at least one segment.
   *
   * When `autoFocus` is false (e.g. initial report load), we populate the
   * cited-organs list so prev/next navigation still works, but do NOT move
   * the camera — the user sees the full model and can zoom manually.
   */
  const applyCardsAndFocus = useCallback(
    (cards, uiActions, { autoFocus = true, skipCardFocusFallback = false } = {}) => {
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

      if (!autoFocus) {
        return;
      }

      /** Server sends `FOCUS_ORGAN` for chat zoom (e.g. "show me …" / vertebra). Prefer it over cards. */
      const rawFocusOrgans = Array.isArray(uiActions)
        ? uiActions.filter(
            (a) => a?.type === 'FOCUS_ORGAN' && typeof a?.organ === 'string' && a.organ.trim()
          )
        : [];
      const focusActions = rawFocusOrgans.filter((a) =>
        isFocusKeyAvailableInCurrentModel(a.organ.trim())
      );
      const explicitFocusRequestedButNoneMapped =
        rawFocusOrgans.length > 0 && focusActions.length === 0;
      const blockCardFocusFallback =
        explicitFocusRequestedButNoneMapped || skipCardFocusFallback;

      const lastActionOrgan =
        focusActions.length > 0 ? focusActions[focusActions.length - 1].organ.trim() : null;
      const targetFocus = lastActionOrgan
        ? lastActionOrgan
        : blockCardFocusFallback
          ? null
          : keys.length > 0
            ? keys[0]
            : null;

      if (targetFocus) {
        handleFocus(targetFocus);
        if (keys.length > 0) {
          const lastFocus = lastActionOrgan ?? keys[0];
          const idx = keys.indexOf(lastFocus);
          if (idx >= 0) setCitedOrganIndex(idx);
          else if (!lastActionOrgan) setCitedOrganIndex(0);
        }
      } else if (blockCardFocusFallback && keys.length > 0) {
        /** Requested structure missing (e.g. C7) but cards mention other organs — keep list, do not zoom. */
        clearCameraFocus();
      } else {
        clearFocus();
      }
    },
    [
      setCitedOrgans,
      setCitedOrganIndex,
      handleFocus,
      clearFocus,
      clearCameraFocus,
    ]
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
    // PERF: Debounce rapid input updates before API-bound actions.
    const timer = window.setTimeout(() => {
      setDebouncedInput(input);
    }, PERFORMANCE_CONFIG.CHAT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (!debouncedInput.trim()) return;
    // PERF: Pre-compute prompt hash on settled input to reduce submit-path work.
    hashPrompt(debouncedInput);
  }, [debouncedInput]);

  useEffect(() => {
    return () => {
      // PERF: Cancel inflight fetches on unmount.
      activeAbortRef.current?.abort();
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const enqueueChatRequest = useCallback((requestFactory) => {
    // PERF: Keep one inflight API call to prevent contention.
    setQueuedRequests((prev) => prev + 1);
    const queued = requestQueueRef.current.then(requestFactory, requestFactory);
    requestQueueRef.current = queued.catch(() => {});
    return queued.finally(() => {
      setQueuedRequests((prev) => Math.max(0, prev - 1));
    });
  }, []);

  const startRequestLoading = useCallback(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setIsLoading(true);
    setAnalyzing(true);
    return requestId;
  }, [setAnalyzing]);

  const stopRequestLoading = useCallback(
    (requestId) => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setIsLoading(false);
      setAnalyzing(false);
    },
    [setAnalyzing]
  );

  useEffect(() => {
    if (!analyzedReport) {
      return;
    }

    /** After refresh, findings may be rehydrated — do not call the API again unless user retries. */
    if (reportAnalyzeTick === 0 && lastCards.length > 0) {
      return;
    }

    const autoSummarize = async () => {
      const requestId = startRequestLoading();
      setLastError(null);
      setLastResponseFromCache(false);
      const prompt = AUTO_SUMMARY_PROMPT_PREFIX + analyzedReport;

      try {
        const reportPayload =
          typeof analyzedReport === 'string' && analyzedReport.trim().length > 0
            ? analyzedReport.trim()
            : null;
        activeAbortRef.current?.abort();
        const controller = new AbortController();
        activeAbortRef.current = controller;
        const data = await enqueueChatRequest(() =>
          sendChatRequest(prompt, reportPayload, { signal: controller.signal })
        );


        const answer = data?.answer ?? data?.reply ?? FALLBACK_REPLY_SUMMARY;
        addMessage('assistant', answer);
        setLastReply(answer);
        const cardsFromApi = Array.isArray(data?.cards) ? data.cards : [];
        setLastCards(cardsFromApi);
        setLastMeta(data?._meta ?? null);
        setLastResponseFromCache(Boolean(data?._fromCache));
        applyCardsAndFocus(cardsFromApi, data?.uiActions ?? [], { autoFocus: false });

        const fp = analyzedReport?.trim() ? hashPrompt(analyzedReport.trim()) : null;
        if (fp && reportPayload) {
          reportExtractDoneFpRef.current = fp;
        }
        if (llmTurnsRef.current.length === 0) {
          llmTurnsRef.current.push({ role: 'user', content: prompt });
          llmTurnsRef.current.push({ role: 'assistant', content: answer });
          trimLlmTurns(llmTurnsRef);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error(err);
        setLastError('report');
        addMessage('assistant', ERROR_REPORT_ANALYSIS);
        setLastCards([]);
        setLastMeta(null);
      } finally {
        stopRequestLoading(requestId);
      }
    };

    autoSummarize();
  }, [
    analyzedReport,
    reportAnalyzeTick,
    lastCards.length,
    addMessage,
    setLastReply,
    applyCardsAndFocus,
    enqueueChatRequest,
    startRequestLoading,
    stopRequestLoading,
  ]);


  const sendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = input.trim();
    const finalPrompt = trimmed;

    if (!finalPrompt || isLoading) {
      return;
    }

    addMessage('user', input);
    setInput('');
    const requestId = startRequestLoading();
    setLastResponseFromCache(false);
    setIsStreaming(false);
    setStreamingText('');

    // Do not clear focus on send — keeps camera stable; user can use "Reset view" in 3D to recenter

    setLastError(null);
    try {
      const reportPayload =
        typeof analyzedReport === 'string' && analyzedReport.trim().length > 0
          ? analyzedReport.trim()
          : null;
      const reportFp = reportPayload ? hashPrompt(reportPayload) : null;
      const shouldAttachReportExtract = Boolean(
        reportFp && reportExtractDoneFpRef.current !== reportFp
      );

      const priorForApi = llmTurnsRef.current.map((t) => ({ role: t.role, content: t.content }));
      const messageForApi =
        priorForApi.length === 0 && analyzedReport?.trim()
          ? buildMessageWithContext(finalPrompt, analyzedReport)
          : finalPrompt;

      activeAbortRef.current?.abort();
      const controller = new AbortController();
      activeAbortRef.current = controller;
      // PERF: Keep typing indicator short, then show real streaming text.
      typingTimerRef.current = window.setTimeout(() => {
        setIsStreaming(true);
      }, STREAMING_TYPING_DELAY_MS);
      const data = await enqueueChatRequest(() =>
        sendChatRequest(messageForApi, shouldAttachReportExtract ? reportPayload : null, {
          signal: controller.signal,
          onStreamChunk: (chunk) => {
            setIsStreaming(true);
            setStreamingText(chunk);
          },
          history: priorForApi.length > 0 ? priorForApi : undefined,
        })
      );
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }


      const answer = data?.answer ?? data?.reply ?? FALLBACK_REPLY_EMPTY;
      const isEmptyReply = typeof answer === 'string' && !answer.trim();

      const rawFocusOrgans = Array.isArray(data?.uiActions)
        ? data.uiActions.filter(
            (a) => a?.type === 'FOCUS_ORGAN' && typeof a.organ === 'string' && a.organ.trim()
          )
        : [];
      const firstUnavailableFocus = rawFocusOrgans.find(
        (a) => !isFocusKeyAvailableInCurrentModel(a.organ.trim())
      );

      const userVertebraIntent = extractVertebraFocusFromPlainText(finalPrompt);
      const userAskedViewNavigation = ZOOM_OR_VIEW_INTENT.test(finalPrompt);
      const clientOnlyUnavailableFocus =
        !firstUnavailableFocus &&
        userAskedViewNavigation &&
        userVertebraIntent &&
        !isFocusKeyAvailableInCurrentModel(userVertebraIntent);

      const hasFocusOnlyAction =
        Array.isArray(data?.uiActions) &&
        data.uiActions.some((a) => a?.type === 'FOCUS_ORGAN' && a.organ);
      if (!(hasFocusOnlyAction && isEmptyReply)) {
        addMessage('assistant', answer);
      }
      if (firstUnavailableFocus) {
        addMessage(
          'assistant',
          ERROR_FOCUS_STRUCTURE_UNAVAILABLE(firstUnavailableFocus.organ.trim())
        );
      } else if (clientOnlyUnavailableFocus) {
        addMessage('assistant', ERROR_FOCUS_STRUCTURE_UNAVAILABLE(userVertebraIntent));
      }

      if (shouldAttachReportExtract && reportFp) {
        reportExtractDoneFpRef.current = reportFp;
      }

      let assistantForHistory = answer;
      if (!(assistantForHistory && assistantForHistory.trim()) && hasFocusOnlyAction) {
        assistantForHistory = '[View: camera focus updated in the 3D viewer.]';
      }
      llmTurnsRef.current.push({ role: 'user', content: messageForApi });
      llmTurnsRef.current.push({ role: 'assistant', content: assistantForHistory });
      trimLlmTurns(llmTurnsRef);

      setLastReply(answer);
      const cardsFromApi = Array.isArray(data?.cards) ? data.cards : null;
      if (cardsFromApi) {
        setLastCards(cardsFromApi);
      }
      const cardsForApply = cardsFromApi ?? useSceneStore.getState().lastCards ?? [];
      setLastMeta(data?._meta ?? null);
      setLastResponseFromCache(Boolean(data?._fromCache));
      applyCardsAndFocus(cardsForApply, data?.uiActions ?? [], {
        skipCardFocusFallback: clientOnlyUnavailableFocus,
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error(err);
      setLastError('connection');
      addMessage('assistant', ERROR_CONNECTION);
      setLastCards([]);
      setLastMeta(null);
    } finally {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      setIsStreaming(false);
      setStreamingText('');
      stopRequestLoading(requestId);
    }
  };

  const handleNewSession = useCallback(() => {
    resetStore();
    setMessages([createMessage('assistant', GREETING)]);
    setInput('');
    setDebouncedInput('');
    setIsStreaming(false);
    setStreamingText('');
    setLastError(null);
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
    llmTurnsRef.current = [];
    reportExtractDoneFpRef.current = null;
    if (key.length > 0) {
      setMessages([createMessage('assistant', GREETING)]);
    }
  }, [analyzedReport]);

  useLayoutEffect(() => {
    if (panelTab !== PANEL_CHAT) return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, lastCards, isLoading, lastError, panelTab, isStreaming, streamingText]);



  const retryReportAnalysis = useCallback(() => {
    const report = useSceneStore.getState().analyzedReport;
    if (!report?.trim()) return;
    setLastError(null);
    setReportAnalyzeTick((t) => t + 1);
  }, []);



  return (
    <div className={`assistant-panel relative flex flex-col h-full min-h-0 ${isLoading ? 'overflow-hidden' : ''}`}>
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 rounded-[16px] p-[1px] [background:linear-gradient(120deg,rgba(59,130,246,0.45),rgba(6,182,212,0.12),rgba(59,130,246,0.45))] [background-size:200%_100%] animate-[shimmer_2.2s_linear_infinite] z-10" />
      )}
      <header
        className="shrink-0 border-b border-white/10 px-3 py-2.5 flex items-center gap-2 min-h-0"
        role="presentation"
      >
        <h2 className="text-sm font-semibold text-text tracking-tight shrink-0 pl-0.5">Clinical Assistant</h2>
        <div
          className="flex-1 min-w-0 flex p-1 rounded-full bg-white/5 border border-white/10 gap-1"
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
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-[var(--brand-primary-dark)] hover:bg-[var(--brand-primary-light)] active:opacity-70" // BRAND: #62C5EF
          title="Sync / reset session"
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
      {(queuedRequests > PERFORMANCE_CONFIG.API_MAX_INFLIGHT || lastResponseFromCache) && (
        <div className="px-3 py-1.5 border-b border-white/10 bg-white/[0.02] text-[11px] text-text-secondary flex items-center justify-between">
          <span>
            {/* PERF: Surface queue pressure to set user expectation. */}
            Queue: {Math.max(0, queuedRequests - PERFORMANCE_CONFIG.API_MAX_INFLIGHT)}
          </span>
          {lastResponseFromCache && <span className="text-[var(--brand-primary-dark)]">From cache</span>} {/* BRAND: #62C5EF */}
        </div>
      )}

      <AnimatePresence mode="wait">
        {panelTab === PANEL_CHAT && (
          <motion.div
            key={PANEL_CHAT}
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0"
          >
            <div
              ref={chatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 app-scrollbar"
              role="log"
              aria-live="polite"
            >
              {lastError === 'connection' && (
                <div className="rounded-xl bg-red-400/10 px-4 py-3 border border-red-300/20">
                  <p className="text-sm text-red-100 leading-snug">
                    Could not reach the assistant. Check that the backend is running.
                  </p>
                  <button type="button" onClick={() => setLastError(null)} className="mt-2 text-sm text-[var(--brand-primary-dark)]"> {/* BRAND: #62C5EF */}
                    Dismiss
                  </button>
                </div>
              )}
              {lastError === 'report' && analyzedReport && (
                <div className="rounded-xl bg-amber-400/10 px-4 py-3 border border-amber-300/20">
                  <p className="text-sm text-amber-100 leading-snug mb-2">
                    Report analysis failed. Retry or keep chatting with the report in context.
                  </p>
                  <button type="button" onClick={retryReportAnalysis} className="text-sm text-[var(--brand-primary-dark)]"> {/* BRAND: #62C5EF */}
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
              {isStreaming && streamingText && (
                <MessageBubble from="assistant" text={streamingText} isGreeting={false} />
              )}

              {lastCards.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                    <span className="text-xs font-semibold text-text-secondary">Findings</span>
                    {lastMeta?.cardsFrom === 'fallback' && (
                      <span className="text-[10px] text-text-secondary font-medium" title="Cards were generated locally.">
                        Local
                      </span>
                    )}
                  </div>
                  {citedOrgans.length > 1 && (
                    <div className="flex items-center justify-center gap-2 py-1.5 mb-2 rounded-xl bg-white/5 border border-white/10" role="group" aria-label="Navigate organs from report">
                      <button type="button" onClick={goToPrevCitedOrgan} className="glass-btn p-1.5 rounded-full" title="Previous organ" aria-label="Previous organ">‹</button>
                      <span className="text-xs font-medium text-text-secondary tabular-nums min-w-[2.75rem] text-center">
                        {citedOrganIndex + 1} / {citedOrgans.length}
                      </span>
                      <button type="button" onClick={goToNextCitedOrgan} className="glass-btn p-1.5 rounded-full" title="Next organ" aria-label="Next organ">›</button>
                    </div>
                  )}
                  {lastCards.length > 20 ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02]">
                      {/* PERF: Virtualize long findings lists to keep DOM light. */}
                      <VirtualList
                        height={Math.min(420, lastCards.length * 68)}
                        rowCount={lastCards.length}
                        rowHeight={68}
                        rowComponent={FindingsRow}
                        rowProps={{ cards: lastCards }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {lastCards.map((c) => (
                        <CardItem key={c.id ?? c.title ?? c.content} card={c} isRisk={c.id === 'card-risks'} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {!analyzedReport && lastCards.length === 0 && !isLoading && (
                <p className="text-xs text-text-secondary text-center px-2 py-2">
                  Select a DICOM study to load the scan report, or ask a question below.
                </p>
              )}
              {isLoading && <LoadingIndicator />}
              <div className="h-1 shrink-0" aria-hidden />
            </div>

            <form
              onSubmit={sendMessage}
              className="shrink-0 border-t border-white/10 px-3 pt-2.5 pb-[max(0.55rem,env(safe-area-inset-bottom,0))]"
            >
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {QUICK_ACTION_CHIPS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="glass-btn rounded-full px-2.5 py-1 text-[11px]"
                    onClick={() => setInput(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <label htmlFor="chat-input" className="sr-only">
                  Message
                </label>
                <input
                  id="chat-input"
                  className="glass-input flex-1 min-w-0 rounded-2xl px-4 py-2.5 text-sm placeholder:text-text-secondary border"
                  placeholder="Ask about findings, anatomy, or request analysis..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  aria-describedby={lastError ? 'chat-error' : undefined}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[var(--text-on-brand)] disabled:opacity-35 disabled:cursor-not-allowed shadow-[var(--shadow-md)]" // BRAND: #62C5EF
                  aria-label="Send"
                >
                  {isLoading ? (
                    <span className="text-lg leading-none opacity-80">…</span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-0.5">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {panelTab === PANEL_TOOLS && (
          <motion.div
            key={PANEL_TOOLS}
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden relative"
          >
            <Suspense fallback={<SkeletonPanel lines={5} className="m-3" />}>
              <ToolsTab onClear={handleNewSessionClick} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {lastError && (
        <p id="chat-error" className="sr-only" role="alert">
          An error occurred. Use Retry to try again.
        </p>
      )}
    </div>
  );
}
