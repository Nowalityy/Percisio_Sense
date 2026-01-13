import { useState, useEffect } from 'react';
import { useSceneStore } from '../store.js';
import { focusOnOrgan } from './Viewer3D.jsx';

const BACKEND_URL = 'http://localhost:4000/chat';

/**
 * Message bubble composant simple.
 */
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

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'assistant',
      text: "Bonjour, je suis votre assistant IA.\nPosez-moi une question sur le scanner ou déposez un compte-rendu pour que je l'analyse.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const setFocus = useSceneStore((s) => s.setFocus);
  const setLastReply = useSceneStore((s) => s.setLastReply);
  const analyzedReport = useSceneStore((s) => s.analyzedReport);

  // Auto-summarize when a report is uploaded
  useEffect(() => {
    if (analyzedReport) {
       const autoSummarize = async () => {
         setIsLoading(true);
         const prompt = `[SYSTEM]: A new medical document has been uploaded. Analyze it in depth. Provide a complete summary, list anomalies by organ, and conclude with a probable diagnosis or recommendations.\n\n[DOCUMENT]:\n${analyzedReport}`;
         
         try {
           const res = await fetch(BACKEND_URL, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ message: prompt }),
           });

           if (!res.ok) throw new Error('Backend error');
           
           const data = await res.json();
           const { reply, focus } = data;

           setMessages((prev) => [
             ...prev,
             {
               id: Date.now(),
               from: 'assistant',
               text: reply || "I received the document, but I cannot summarize it.",
             },
           ]);
           setLastReply(reply || '');
           if (focus) {
             setFocus(focus);
             focusOnOrgan(focus);
           }
         } catch (err) {
           console.error(err);
           setMessages((prev) => [
             ...prev,
             {
               id: Date.now(),
               from: 'assistant',
               text: "Error during automatic document analysis.",
             },
           ]);
         } finally {
            setIsLoading(false);
         }
       };
       autoSummarize();
    }
  }, [analyzedReport, setFocus, setLastReply]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg = {
      id: Date.now(),
      from: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const report = useSceneStore.getState().analyzedReport;
    let messageToSend = trimmed;
    
    // If a report is analyzed, add it to the question context
    if (report) {
      messageToSend = `[CONTEXT - ANALYZED DOCUMENT]:\n${report}\n\n[USER QUESTION]:\n${trimmed}`;
    }

    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageToSend }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const { reply, focus } = data;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          from: 'assistant',
          text: reply || '(pas de réponse)',
        },
      ]);

      setLastReply(reply || '');

      // Interaction IA -> 3D
      if (focus) {
        setFocus(focus);
        focusOnOrgan(focus);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          from: 'assistant',
          text:
            "Désolé, je n'arrive pas à contacter l'API backend.\n" +
            'Vérifiez que le serveur Node tourne sur http://localhost:4000.',
        },
      ]);
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {messages.map((m) => (
          <MessageBubble key={m.id} from={m.from} text={m.text} />
        ))}
        {isLoading && (
            <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm border border-border shadow-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
            </div>
            </div>
        )}
      </div>

      <form
        onSubmit={sendMessage}
        className="border-t border-border px-3 py-2 flex items-center gap-2 bg-white"
      >
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
