import { useState, lazy, Suspense } from 'react';

// Lazy-load heavy chunks (Three.js + R3F + viewer, Chatbot) for better LCP and TTI
const Viewer3D = lazy(() => import('./components/Viewer3D.jsx'));
const Chatbot = lazy(() => import('./components/Chatbot.jsx'));

function ViewerFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 bg-white" aria-hidden="true">
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
    <div className="h-dvh flex flex-col bg-white text-text overflow-hidden">
      <header className="px-4 py-2.5 md:px-6 md:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 shrink-0 bg-white border-b border-[#E5E7EB]">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl md:text-2xl tracking-tight text-text">
            <span className="font-semibold">Percisio</span>{' '}
            <span className="font-medium text-accent">Sense</span>
          </h1>
          <p className="text-[11px] md:text-xs text-text-secondary font-normal" style={{ letterSpacing: '-0.01em' }}>
            AI-Powered 3D Clinical Imaging Platform
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 p-3 md:p-5 min-h-0 overflow-hidden">
        {/* Viewer: 70% (flex 7/10) */}
        <section
          className={`rounded-md overflow-hidden flex flex-col flex-1 min-h-0 bg-white border border-[#E5E7EB] min-w-0 md:flex-[7] ${
            mobilePanel === 'viewer' ? 'flex' : 'hidden md:flex'
          }`}
          aria-label="3D Viewer"
          style={{ boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)' }}
        >
          <div className="px-4 md:px-5 py-1.5 md:py-2 border-b border-[#E5E7EB] shrink-0 bg-white">
            <h2 className="text-sm font-bold text-text tracking-tight">Clinical 3D Reconstruction</h2>
            <p className="text-sm text-slate-500 mt-0.5 md:mt-1">Interactive anatomical model</p>
            <div className="flex md:hidden gap-1.5 mt-1.5 md:mt-2">
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

        {/* Assistant: 30% (flex 3/10), min-width pour que les onglets + More restent entiers */}
        <section
          className={`flex flex-col min-h-0 overflow-hidden flex-1 md:flex-[3] md:min-w-[300px] w-full bg-white md:border-l ${mobilePanel === 'chat' ? 'flex' : 'hidden md:flex'}`}
          style={{ borderLeftColor: 'rgba(15,23,42,0.08)' }}
          aria-label="Clinical AI Analysis"
        >
          <div className="flex md:hidden gap-1.5 px-4 md:px-5 py-1.5 md:py-2 border-b border-[#E5E7EB] shrink-0 bg-white">
            <button
              type="button"
              onClick={() => setMobilePanel('viewer')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mobilePanel === 'viewer' ? 'bg-accent text-white' : 'text-text-secondary'}`}
              aria-pressed={mobilePanel === 'viewer'}
              aria-label="Show 3D viewer"
            >
              Viewer
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel('chat')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mobilePanel === 'chat' ? 'bg-accent text-white' : 'text-text-secondary'}`}
              aria-pressed={mobilePanel === 'chat'}
              aria-label="Show AI assistant"
            >
              Chat
            </button>
          </div>
          <div className="flex-1 rounded-md overflow-hidden flex flex-col min-h-0 bg-white flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <Suspense fallback={<ChatbotFallback />}>
                <Chatbot />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

