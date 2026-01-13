import Viewer3D from './components/Viewer3D.jsx';
import Chatbot from './components/Chatbot.jsx';

function App() {
  return (
    <div className="h-dvh flex flex-col bg-background text-text overflow-hidden">
      <header className="px-4 py-3 md:px-6 md:py-4 border-b border-border flex items-center justify-between bg-white shadow-sm shrink-0">
        <h1 className="text-lg md:text-xl font-semibold tracking-tight text-text">
          Percisio <span className="text-accent">Sense</span>
        </h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-3 md:gap-4 p-2 md:p-4 bg-gray-50 min-h-0 overflow-hidden">
        {/* Mobile: Viewer takes 45% height, Desktop: flex-1 */}
        <section className="h-[45%] md:h-auto md:flex-1 rounded-xl bg-panel border border-border overflow-hidden flex flex-col shadow-sm shrink-0 md:shrink">
          <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-text-secondary bg-white shrink-0">
            3D Viewer
          </div>
          <div className="flex-1 relative">
            <Viewer3D />
          </div>
        </section>

        <section className="flex-1 md:flex-none w-full md:w-[380px] xl:w-[420px] flex flex-col gap-3 md:gap-4 min-h-0 overflow-hidden">
          {/* AI Assistant takes full height now */}
          <div className="flex-1 bg-panel border border-border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-text-secondary bg-white shrink-0">
              AI Assistant
            </div>
            <Chatbot />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

