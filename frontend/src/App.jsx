import Viewer3D from './components/Viewer3D.jsx';
import Chatbot from './components/Chatbot.jsx';
import FileAnalyzer from './components/FileAnalyzer.jsx';

function App() {
  return (
    <div className="h-screen flex flex-col bg-background text-text overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-white shadow-sm shrink-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Percisio <span className="text-accent">Insight</span>
        </h1>
        <span className="text-xs text-text-secondary">React • Three.js • IA</span>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 bg-gray-50 min-h-0 overflow-hidden">
        <section className="flex-1 rounded-xl bg-panel border border-border overflow-hidden flex flex-col shadow-sm">
          <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-text-secondary bg-white">
            Viewer 3D
          </div>
          <div className="flex-1">
            <Viewer3D />
          </div>
        </section>

        <section className="w-full md:w-[380px] xl:w-[420px] flex flex-col gap-4 min-h-0">
          <div className="h-[200px] bg-panel border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
             <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-text-secondary bg-white">
              Analyse Doc
            </div>
            <div className="flex-1 p-3">
              <FileAnalyzer />
            </div>
          </div>
          
          <div className="flex-1 bg-panel border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-text-secondary bg-white">
              Assistant IA
            </div>
            <Chatbot />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

