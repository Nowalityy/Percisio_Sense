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

async function sendChatRequest(message) {
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
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
        const data = await sendChatRequest(prompt);
        const { reply, focus } = data;

        addMessage('assistant', reply ?? FALLBACK_REPLY_SUMMARY);
        setLastReply(reply ?? '');
        handleFocus(focus);
      } catch (err) {
        console.error(err);
        setLastError('report');
        addMessage('assistant', ERROR_REPORT_ANALYSIS);
      } finally {
        setIsLoading(false);
      }
    };

    autoSummarize();
  }, [analyzedReport, addMessage, setLastReply, handleFocus]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = input.trim();

    if (!trimmed || isLoading) {
      return;
    }

    addMessage('user', input);
    setInput('');
    setIsLoading(true);

    useSceneStore.getState().clearFocus();

    const messageToSend = buildMessageWithContext(trimmed, analyzedReport);

    setLastError(null);
    try {
      const data = await sendChatRequest(messageToSend);
      const { reply, focus } = data;

      addMessage('assistant', reply ?? FALLBACK_REPLY_EMPTY);
      setLastReply(reply ?? '');
      handleFocus(focus);
    } catch (err) {
      console.error(err);
      setLastError('connection');
      addMessage('assistant', ERROR_CONNECTION);
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
        {lastError === 'connection' && (
          <button type="button" onClick={() => setLastError(null)} className="text-xs text-accent hover:underline shrink-0">
            Dismiss
          </button>
        )}
        {lastError === 'report' && analyzedReport && (
          <button type="button" onClick={retryReportAnalysis} className="text-xs text-accent hover:underline shrink-0">
            Retry analysis
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" role="log" aria-live="polite">
        {messages.map((m) => (
          <MessageBubble key={m.id} from={m.from} text={m.text} />
        ))}
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
