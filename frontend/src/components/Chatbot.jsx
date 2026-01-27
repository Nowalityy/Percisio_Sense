import { useState, useEffect, useCallback } from 'react';
import { useSceneStore } from '../store.js';
import { focusOnOrgan } from './Viewer3D.jsx';
import { QuickActions } from './Chatbot/QuickActions';
import { ConversationHistory } from './Chatbot/ConversationHistory';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/chat';
const AUTO_SUMMARY_PROMPT_PREFIX = '[SYSTEM]: A new medical document has been uploaded. Analyze it in depth. Provide a complete summary, list anomalies by organ, and conclude with a probable diagnosis or recommendations.\n\n[DOCUMENT]:\n';
const CONTEXT_PROMPT_TEMPLATE = '[CONTEXT - ANALYZED DOCUMENT]:\n{report}\n\n[USER QUESTION]:\n{question}';

function MessageBubble({ from, text }) {
  const isUser = from === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed border ${
          isUser
            ? 'bg-accent text-white border-accent/60'
            : 'bg-white text-text border-border shadow-sm'
        }`}
      >
        {text.split('\n').map((line, idx) => (
          <p key={idx}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm border border-border shadow-sm flex items-center gap-2">
        {[0, 0.15, 0.3].map((delay, idx) => (
          <span
            key={idx}
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function createMessage(from, text, idOffset = 0) {
  return {
    id: Date.now() + idOffset,
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
  const [messages, setMessages] = useState([
    createMessage(
      'assistant',
      "Bonjour, je suis votre assistant IA.\nPosez-moi une question sur le scanner ou déposez un compte-rendu pour que je l'analyse."
    ),
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    (from, text, idOffset = 0) => {
      const message = createMessage(from, text, idOffset);
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
      const prompt = AUTO_SUMMARY_PROMPT_PREFIX + analyzedReport;

      try {
        const data = await sendChatRequest(prompt);
        const { reply, focus } = data;

        addMessage('assistant', reply || "I received the document, but I cannot summarize it.");
        setLastReply(reply || '');
        handleFocus(focus);
      } catch (err) {
        console.error(err);
        addMessage('assistant', 'Error during automatic document analysis.');
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

    try {
      const data = await sendChatRequest(messageToSend);
      const { reply, focus } = data;

      addMessage('assistant', reply || '(pas de réponse)', 1);
      setLastReply(reply || '');
      handleFocus(focus);
    } catch (err) {
      console.error(err);
      addMessage(
        'assistant',
        "Désolé, je n'arrive pas à contacter l'API backend.\nVérifiez que le serveur Node tourne sur http://localhost:4000.",
        2
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      <ConversationHistory />
      <QuickActions />
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {messages.map((m) => (
          <MessageBubble key={m.id} from={m.from} text={m.text} />
        ))}
        {isLoading && <LoadingIndicator />}
      </div>

      <form onSubmit={sendMessage} className="border-t border-border px-3 py-2 flex items-center gap-2 bg-white">
        <input
          className="flex-1 bg-gray-50 rounded-full px-3 py-2 text-base md:text-sm outline-none border border-border focus:border-accent focus:bg-white transition-colors text-text placeholder:text-text-secondary"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-3 md:px-4 py-2 rounded-full text-sm font-medium bg-accent text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:bg-blue-600 shrink-0"
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
