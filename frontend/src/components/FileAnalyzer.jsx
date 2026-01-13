import { useState, useRef } from 'react';
import { useSceneStore } from '../store.js';

export default function FileAnalyzer() {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileName, setFileName] = useState(null);
  const setAnalyzedReport = useSceneStore((s) => s.setAnalyzedReport);

  const dragCounter = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      setFileName(file.name);
      setIsAnalyzing(true);

      // Simulation d'analyse (ou lecture réelle si .txt)
      try {
        let content = '';
        if (file.type === 'text/plain') {
          content = await file.text();
        } else {
          // Simulation pur pour PDF/Image pour l'instant
          await new Promise((resolve) => setTimeout(resolve, 2000));
          content = `[ANALYSE DU FICHIER ${file.name}]\n\n` +
            "Type : Compte-rendu médical (Scanner Thoraco-Abdomino-Pelvien)\n" +
            "Date : 12/01/2026\n" +
            "Patient : Ananyme\n\n" +
            "OBSERVATIONS :\n" +
            "- Foie : Taille et morphologie normales. Pas d'anomalie focale.\n" +
            "- Reins : Pas de dilatation des cavités pyélo-calicielles.\n" +
            "- Poumons : Pas de nodule suspect. Légère condensation basale droite.\n" +
            "- Cœur : Silouhette cardiaque dans les limites de la normale.\n" +
            "- Cerveau : Structures médianes en place.\n\n" +
            "CONCLUSION :\n" +
            "Examen sans particularité notable, à corréler avec la clinique.";
        }

        setAnalyzedReport(content);
      } catch (err) {
        console.error("Erreur lecture fichier", err);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div
      className={`h-full w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center p-4 cursor-pointer relative overflow-hidden ${
        isDragging
          ? 'border-accent bg-accent/5'
          : fileName
            ? 'border-green-500/30 bg-green-50/50'
            : 'border-border bg-gray-50/50 hover:bg-gray-100'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isAnalyzing ? (
        <div className="animate-pulse flex flex-col items-center">
          <svg className="w-8 h-8 text-accent mb-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-xs font-medium text-accent">Analyse de {fileName}...</p>
        </div>
      ) : fileName ? (
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2 text-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">{fileName}</p>
          <p className="text-xs text-green-600 mt-1">Analyse terminée & transmise à l'IA</p>
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Évite de rouvrir le sélecteur si on en ajoute un
              setFileName(null);
              setAnalyzedReport(null);
            }} 
            className="mt-3 text-[10px] text-gray-400 hover:text-red-500 underline"
          >
            Changer de fichier
          </button>
        </div>
      ) : (
        <>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragging ? 'bg-accent text-white' : 'bg-white text-gray-400 shadow-sm'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <p className="text-sm font-medium text-text">
            Glissez un compte-rendu médical
          </p>
          <p className="text-[10px] text-text-secondary mt-1">
            L'IA analysera le contenu pour vous aider
          </p>
        </>
      )}
    </div>
  );
}
