import { useState, lazy, Suspense } from 'react';

// Lazy-load heavy chunks (Three.js + R3F + viewer, Chatbot) for better LCP and TTI
const Viewer3D = lazy(() => import('./components/Viewer3D.jsx'));
const Chatbot = lazy(() => import('./components/Chatbot.jsx'));

function ViewerFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 bg-slate-50/50" aria-hidden="true">
      <div className="text-sm text-text-secondary">Loading viewer…</div>
    </div>
  );
}

function ChatbotFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 bg-white" aria-hidden="true">
      <div className="text-sm text-text-secondary">Loading…</div>
    </div>
  );
}

function App() {
  const [mobilePanel, setMobilePanel] = useState('viewer'); // 'viewer' | 'chat'

  return (
    <div className="h-dvh flex flex-col bg-background text-text overflow-hidden">
      <header className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between shrink-0 bg-white border-b border-border shadow-sm">
        <h1 className="text-lg md:text-xl font-semibold tracking-tight text-text">
          Percisio <span className="text-accent">Sense</span>
        </h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-4 p-3 md:p-4 min-h-0 overflow-hidden">
        {/* Viewer: card with clear border */}
        <section
          className={`rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0 bg-white border border-border shadow-md ${
            mobilePanel === 'viewer' ? 'flex md:flex-1' : 'hidden md:flex md:flex-1'
          }`}
          aria-label="3D Viewer"
        >
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0 bg-slate-50">
            <span className="text-xs uppercase tracking-wider font-medium text-text-secondary">3D Viewer</span>
            <div className="flex md:hidden gap-1.5">
              <button
                type="button"
                onClick={() => setMobilePanel('viewer')}
                className={`glass-btn px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${mobilePanel === 'viewer' ? '!bg-accent !text-white !border-accent/30' : 'text-text-secondary'}`}
                aria-pressed={mobilePanel === 'viewer'}
                aria-label="Show 3D viewer"
              >
                Viewer
              </button>
              <button
                type="button"
                onClick={() => setMobilePanel('chat')}
                className={`glass-btn px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${mobilePanel === 'chat' ? '!bg-accent !text-white !border-accent/30' : 'text-text-secondary'}`}
                aria-pressed={mobilePanel === 'chat'}
                aria-label="Show AI assistant"
              >
                Chat
              </button>
            </div>
          </div>
          <div className="flex-1 relative min-h-0">
            <Suspense fallback={<ViewerFallback />}>
              <Viewer3D />
            </Suspense>
          </div>
        </section>

        {/* Chat: card with clear border */}
        <section
          className={`flex flex-col gap-4 min-h-0 overflow-hidden flex-1 md:flex-none w-full md:w-[380px] xl:w-[420px] ${mobilePanel === 'chat' ? 'flex' : 'hidden md:flex'}`}
          aria-label="AI Assistant"
        >
          <div className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-0 bg-white border border-border shadow-md">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0 bg-slate-50">
              <span className="text-xs uppercase tracking-wider font-medium text-text-secondary">AI Assistant</span>
              <div className="flex md:hidden gap-1.5">
                <button
                  type="button"
                  onClick={() => setMobilePanel('viewer')}
                  className={`glass-btn px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${mobilePanel === 'viewer' ? '!bg-accent !text-white !border-accent/30' : 'text-text-secondary'}`}
                  aria-pressed={mobilePanel === 'viewer'}
                  aria-label="Show 3D viewer"
                >
                  Viewer
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePanel('chat')}
                  className={`glass-btn px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${mobilePanel === 'chat' ? '!bg-accent !text-white !border-accent/30' : 'text-text-secondary'}`}
                  aria-pressed={mobilePanel === 'chat'}
                  aria-label="Show AI assistant"
                >
                  Chat
                </button>
              </div>
            </div>
            <Suspense fallback={<ChatbotFallback />}>
              <Chatbot />
            </Suspense>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

