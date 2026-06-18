import { memo, useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { Icon, Badge, BrandMark } from './psUI.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
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

/** Grounded prompt suggestions shown above the composer. */
const SUGGESTIONS = [
  'Summarise for the patient',
  'Explain the key findings',
  'What are the recommended next steps?',
];

const AUTO_SUMMARY_PROMPT_PREFIX =
  '[SYSTEM]: A new imaging report has been loaded.\n\n' +
  'Write a concise clinical IMPRESSION of the scan for the report panel:\n' +
  '- 2 to 3 sentences, in clear English, no headings, no bullet lists, no disclaimer.\n' +
  '- State the principal diagnostic conclusion and the single most important takeaway.\n' +
  '- Do NOT re-list every finding, and do NOT add meta-commentary or invitations to ask questions.\n\n' +
  '[DOCUMENT CONTENT]:\n';
const CONTEXT_PROMPT_TEMPLATE =
  '[CONTEXT - ANALYZED DOCUMENT]:\n{report}\n\n---\n\n' +
  'Instructions: Answer using this document as the source. **Reply in English.** Do not repeat or paste the full report; use synthesis and short structured sections as appropriate.\n\n' +
  '[USER INQUIRY]:\n{question}';

const FALLBACK_REPLY_SUMMARY = "I received the document, but I cannot summarize it.";
const FALLBACK_REPLY_EMPTY = '(no response)';
const ERROR_CONNECTION =
  "Could not reach the assistant. Check that the backend is running (e.g. http://localhost:4000) and try again.";
/** Shown when the model tries to focus a structure that this scan / segment set does not include. */
const ERROR_FOCUS_STRUCTURE_UNAVAILABLE = (label) =>
  `**${label}** is not available in the current 3D model. This export may not include that organ or bone — try another structure or switch the study if your dataset supports it.`;
const GREETING =
  "Percisio AI is ready.\nUpload a report or request a targeted analysis.";
const STREAMING_TYPING_DELAY_MS = 200;

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
            className="mono"
            style={{ fontSize: 12, background: 'var(--elevated)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}
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
            style={{ borderRadius: 4, background: 'var(--accent-dim)', padding: '1px 4px', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}
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
    <div className="[&_p+p]:mt-2 [&_ul]:mt-2 [&_ol]:mt-2 [&_li]:my-0.5 [&_strong]:font-semibold">
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
      <div style={{ minHeight: 240, display: 'grid', placeItems: 'center', padding: '0 8px' }} role="listitem">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center', maxWidth: '19rem' }}
        >
          <div style={{ width: 52, height: 52, margin: '0 auto 14px', borderRadius: 12, border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', background: 'var(--accent-dim)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
            <Icon name="sparkles" size={24} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Clinical Assistant ready</h3>
          <p style={{ marginTop: 4, fontSize: 13, lineHeight: 1.55, color: 'var(--muted)' }}>
            Ask me anything about your report.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`ca-msg ${isUser ? 'doc' : 'ai'}`} role="listitem">
      <div className={`ca-ava ${isUser ? 'doc' : 'ai'}`}>{isUser ? 'ME' : <BrandMark size={16} />}</div>
      <div className="grow">
        <div className="ca-bubble">
          {isUser ? (
            text.split('\n').map((line, idx) => (
              <p key={idx} style={idx > 0 ? { marginTop: 6 } : undefined}>{line}</p>
            ))
          ) : (
            <SimpleMarkdown text={text} />
          )}
        </div>
      </div>
    </div>
  );
});

const LoadingIndicator = memo(function LoadingIndicator() {
  return (
    <div className="ca-msg ai" aria-live="polite" aria-busy="true">
      <div className="ca-ava ai"><BrandMark size={16} /></div>
      <div className="grow">
        <div className="ca-bubble" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '6px 2px' }}>
          {[0, 0.15, 0.3].map((delay, idx) => (
            <span
              key={idx}
              className="animate-bounce"
              style={{ height: 6, width: 6, borderRadius: 999, background: 'var(--accent)', animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      </div>
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

/** After restoring a persisted thread, continue ids past the restored ones. */
function syncMessageIdCounter(messages) {
  for (const m of messages) {
    if (typeof m?.id === 'number' && m.id > messageIdCounter) {
      messageIdCounter = m.id;
    }
  }
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

  if (response.body && contentType.includes('text/event-stream')) {
    payload = await readChatEventStream(response.body, onStreamChunk);
  } else if (response.body && !contentType.includes('application/json')) {
    // Legacy raw-text stream (older backend) — concatenate as the answer.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamedText = '';
    for (;;) {
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

/**
 * Parse the backend SSE chat stream into the payload shape the rest of the
 * component expects ({ answer, uiActions, cards?, impression?, recommendations?, _meta }).
 * Frames are `data: <json>\n\n`; `delta` carries reply tokens, `final` carries
 * focus + structured panel data, and `[DONE]` terminates.
 */
async function readChatEventStream(body, onStreamChunk) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  const payload = { answer: '', uiActions: [] };

  const handleFrame = (jsonStr) => {
    if (jsonStr === '[DONE]') return;
    let frame;
    try {
      frame = JSON.parse(jsonStr);
    } catch {
      return;
    }
    if (frame.type === 'delta' && typeof frame.text === 'string') {
      answer += frame.text;
      onStreamChunk?.(answer);
    } else if (frame.type === 'final') {
      if (frame.focus) payload.uiActions = [{ type: 'FOCUS_ORGAN', organ: frame.focus }];
      if (Array.isArray(frame.cards)) payload.cards = frame.cards;
      if (typeof frame.impression === 'string') payload.impression = frame.impression;
      if (Array.isArray(frame.recommendations)) payload.recommendations = frame.recommendations;
      if (frame.meta) payload._meta = frame.meta;
    } else if (frame.type === 'error') {
      throw new Error(frame.message || 'stream error');
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const rawFrame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = rawFrame.startsWith('data:') ? rawFrame.slice(5).trim() : rawFrame.trim();
      if (line) handleFrame(line);
    }
  }
  const tail = buffer.trim();
  if (tail) handleFrame(tail.startsWith('data:') ? tail.slice(5).trim() : tail);

  payload.answer = answer;
  return payload;
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
    if (hist.length > 0) {
      syncMessageIdCounter(hist);
      return hist;
    }
    return [createMessage('assistant', GREETING)];
  });
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [queuedRequests, setQueuedRequests] = useState(0);
  const [lastResponseFromCache, setLastResponseFromCache] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [reportAnalyzeTick, setReportAnalyzeTick] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const chatScrollRef = useRef(null);
  const lastReportKeyRef = useRef(null);
  const llmTurnsRef = useRef([]);
  const reportExtractDoneFpRef = useRef(null);
  /** Fingerprint of the report whose intro summary was already posted. */
  const autoSummaryDoneFpRef = useRef(null);
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
  const setLastImpression = useSceneStore((s) => s.setLastImpression);
  const setLastRecommendations = useSceneStore((s) => s.setLastRecommendations);
  const analyzedReport = useSceneStore((s) => s.analyzedReport);
  const addToConversationHistory = useSceneStore((s) => s.addToConversationHistory);
  const setAnalyzing = useSceneStore((s) => s.setAnalyzing);
  const resetStore = useSceneStore((s) => s.resetStore);
  const lastCards = useSceneStore((s) => s.lastCards);
  const setLastCards = useSceneStore((s) => s.setLastCards);
  const setLastMeta = useSceneStore((s) => s.setLastMeta);


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

    /**
     * Once per report (unless the user hits Retry): a later chat reply can
     * clobber `lastCards` to [] — without this guard the effect re-fired and
     * posted a second, near-identical intro summary after the user's message.
     */
    const reportFingerprint = hashPrompt(analyzedReport.trim());
    if (reportAnalyzeTick === 0 && autoSummaryDoneFpRef.current === reportFingerprint) {
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

        autoSummaryDoneFpRef.current = reportFingerprint;

        /* PER-51: the auto-summary becomes the panel's Impression — it is NOT
           posted to the chat, so the thread stays empty for the clinician's
           own questions. Findings / Risks / Recommendations come from cards. */
        const answer = data?.answer ?? data?.reply ?? FALLBACK_REPLY_SUMMARY;
        const cardsFromApi = Array.isArray(data?.cards) ? data.cards : [];
        setLastReply(answer);
        setLastCards(cardsFromApi);
        setLastImpression(answer);
        if (Array.isArray(data?.recommendations)) setLastRecommendations(data.recommendations);
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
        /* The 'report' banner (with Retry) covers the failure — no chat message. */
        setLastError('report');
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
    setLastImpression,
    setLastRecommendations,
    applyCardsAndFocus,
    enqueueChatRequest,
    startRequestLoading,
    stopRequestLoading,
  ]);


  const sendMessage = async (e, presetText) => {
    e?.preventDefault();
    const source = typeof presetText === 'string' ? presetText : input;
    const trimmed = source.trim();
    const finalPrompt = trimmed;

    if (!finalPrompt || isLoading) {
      return;
    }

    addMessage('user', source);
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

      /* PER-48: the Radiology Report panel (Impression / Recommendations) is
         driven by the structured analysis in `lastReply` — ordinary chat
         replies must not clobber it, or the Impression section vanishes after
         the first question. Cards likewise only update when the reply
         actually carries some (an empty array would wipe the findings). */
      const cardsFromApi =
        Array.isArray(data?.cards) && data.cards.length > 0 ? data.cards : null;
      if (cardsFromApi) {
        setLastCards(cardsFromApi);
        /* Only refresh the panel's structured fields alongside fresh cards. */
        if (typeof data?.impression === 'string' && data.impression.trim()) {
          setLastImpression(data.impression);
        }
        if (Array.isArray(data?.recommendations) && data.recommendations.length > 0) {
          setLastRecommendations(data.recommendations);
        }
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
      /* PER-48: a failed chat turn must not wipe the report panel
         (findings stay; only the meta of this attempt is dropped). */
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
    /* The default report reloads with identical text — allow its intro summary again. */
    autoSummaryDoneFpRef.current = null;
    setMessages([createMessage('assistant', GREETING)]);
    setInput('');
    setDebouncedInput('');
    setIsStreaming(false);
    setStreamingText('');
    setLastError(null);
  }, [resetStore]);

  const handleResetConfirmed = useCallback(() => {
    setShowResetConfirm(false);
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

  /**
   * When a NEW message appears, anchor the scroll at the TOP of that message
   * so it is read from the start (long assistant replies were landing the
   * user at the bottom). While a streamed reply grows, keep the anchor.
   */
  const lastAnchorCountRef = useRef(0);
  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const count =
      messages.length + (isStreaming && streamingText ? 1 : 0) + (isLoading ? 1 : 0);
    if (count === lastAnchorCountRef.current) return;
    lastAnchorCountRef.current = count;
    const items = el.querySelectorAll('.ca-msg');
    const last = items[items.length - 1];
    if (!last) {
      el.scrollTop = 0;
      return;
    }
    const top =
      last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTop = Math.max(0, top - 6);
  }, [messages, isLoading, isStreaming, streamingText]);

  /** Error banners render above the thread — bring them into view. */
  useLayoutEffect(() => {
    if (lastError && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = 0;
    }
  }, [lastError]);



  const retryReportAnalysis = useCallback(() => {
    const report = useSceneStore.getState().analyzedReport;
    if (!report?.trim()) return;
    setLastError(null);
    setReportAnalyzeTick((t) => t + 1);
  }, []);



  const composerDisabled = isLoading;

  return (
    <div className="col gap14" style={{ height: '100%', padding: 16, minHeight: 0 }}>
      {/* header */}
      <div className="row gap12" style={{ flex: 'none' }}>
        <Icon name="sparkles" size={17} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>Clinical Assistant</span>
        <span style={{ marginLeft: 'auto' }}><Badge cls="green" dot>Grounded</Badge></span>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="ps-btn icon sm"
          title="New conversation — clears messages and report"
          aria-label="New conversation — clears messages and report"
        >
          <Icon name="refresh" size={15} />
        </button>
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          title="Start a new conversation?"
          message="All messages and the loaded report will be cleared. This can't be undone."
          confirmLabel="New conversation"
          cancelLabel="Cancel"
          tone="danger"
          onConfirm={handleResetConfirmed}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {(queuedRequests > PERFORMANCE_CONFIG.API_MAX_INFLIGHT || lastResponseFromCache) && (
        <div className="row" style={{ flex: 'none', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
          {/* PERF: Surface queue pressure to set user expectation. */}
          <span>Queue: {Math.max(0, queuedRequests - PERFORMANCE_CONFIG.API_MAX_INFLIGHT)}</span>
          {lastResponseFromCache && <span style={{ color: 'var(--accent)' }}>From cache</span>}
        </div>
      )}

      {/* messages */}
      <div
        ref={chatScrollRef}
        className="grow col scroll-y"
        style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
        role="log"
        aria-live="polite"
      >
        {lastError === 'connection' && (
          <div style={{ borderRadius: 6, background: 'var(--red-dim)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', padding: '11px 13px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.4 }}>Could not reach the assistant. Check that the backend is running.</p>
            <button type="button" onClick={() => setLastError(null)} style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
          </div>
        )}
        {lastError === 'report' && analyzedReport && (
          <div style={{ borderRadius: 6, background: 'var(--amber-dim)', border: '1px solid color-mix(in srgb, var(--amber) 25%, transparent)', padding: '11px 13px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--amber)', lineHeight: 1.4, marginBottom: 6 }}>Report analysis failed. Retry or keep chatting with the report in context.</p>
            <button type="button" onClick={retryReportAnalysis} style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            from={m.from}
            text={m.text}
            isGreeting={m.from === 'assistant' && m.text === GREETING}
          />
        ))}
        {isStreaming && streamingText && (
          <MessageBubble from="assistant" text={streamingText} isGreeting={false} />
        )}
        {isLoading && <LoadingIndicator />}
      </div>

      {/* grounded suggestion chips */}
      <div className="ca-sugs" style={{ flex: 'none' }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="ca-sug" onClick={() => sendMessage(null, s)} disabled={composerDisabled}>
            {s}
          </button>
        ))}
      </div>

      {/* composer */}
      <form onSubmit={sendMessage} className="ca-input" style={{ flex: 'none' }}>
        <Icon name="message-circle" size={16} color="var(--faint)" />
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input
          id="chat-input"
          placeholder="Ask me anything about your report"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={composerDisabled}
          aria-describedby={lastError ? 'chat-error' : undefined}
        />
        <button type="submit" className="ca-send" disabled={isLoading || !input.trim()} aria-label="Send">
          <Icon name={isLoading ? 'dots' : 'arrow-up'} size={16} />
        </button>
      </form>

      {/* Single standing disclaimer — replaces the per-message disclaimer blocks. */}
      <p
        style={{ flex: 'none', margin: 0, fontSize: 10.5, lineHeight: 1.4, color: 'var(--faint)', textAlign: 'center' }}
      >
        Clinical decision support — verify against the source report and clinical judgement.
      </p>

      {lastError && (
        <p id="chat-error" className="sr-only" role="alert">An error occurred. Use Retry to try again.</p>
      )}
    </div>
  );
}
