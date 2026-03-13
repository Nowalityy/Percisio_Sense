import { useState, useRef } from 'react';
import { useSceneStore } from '../../store';

const MAX_FILE_SIZE_MB = 2;
/** Align with backend MAX_MESSAGE_LENGTH to avoid sending oversized content. */
const MAX_PASTE_LENGTH = 100_000;

const DEFAULT_BACKEND_URL = 'http://localhost:4000/chat';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL;
const PDF_EXTRACT_URL = BACKEND_URL.replace('/chat', '/extract-pdf');

export function ReportInput() {
  const [isOpen, setIsOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [reportError, setReportError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const setAnalyzedReport = useSceneStore((s) => s.setAnalyzedReport);

  const handleSubmit = () => {
    const text = paste.trim();
    if (!text) {
      setReportError('Please paste or upload report text.');
      return;
    }
    if (text.length > MAX_PASTE_LENGTH) {
      setReportError(`Report text must not exceed ${MAX_PASTE_LENGTH.toLocaleString()} characters.`);
      return;
    }
    setReportError(null);
    setAnalyzedReport(text);
    setPaste('');
    setIsOpen(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReportError(null);

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setReportError(`File must be under ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    if (file.type === 'application/pdf') {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('report', file);

      try {
        const res = await fetch(PDF_EXTRACT_URL, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to extract PDF');
        setPaste(data.text || '');
      } catch (err) {
        setReportError(err.message);
      } finally {
        setIsUploading(false);
      }
    } else if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = () => {
        setPaste(String(reader.result ?? ''));
      };
      reader.onerror = () => setReportError('Could not read file.');
      reader.readAsText(file);
    } else {
      setReportError('Only .txt and .pdf files are supported.');
    }
    e.target.value = '';
  };

  const handleClose = () => {
    setIsOpen(false);
    setReportError(null);
    setPaste('');
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="glass-btn px-2.5 py-1.5 text-xs font-medium rounded-md text-text hover:!bg-accent hover:!text-white hover:!border-accent/30 transition-colors"
        aria-label="Add or paste report for analysis"
      >
        Add report
      </button>
    );
  }

  return (
    <div className="absolute inset-0 z-20 bg-white rounded-2xl border border-border shadow-xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-slate-50 rounded-t-2xl">
        <h3 id="report-dialog-title" className="text-sm font-semibold text-text">Paste or upload report</h3>
        <button
          type="button"
          onClick={handleClose}
          className="glass-btn p-1.5 rounded-xl text-text-secondary hover:text-text transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 gap-3">
        <label className="text-xs font-medium text-text-secondary shrink-0">
          Paste report text below or upload a .txt or .pdf file
        </label>
        <textarea
          value={paste}
          onChange={(e) => { setPaste(e.target.value); setReportError(null); }}
          placeholder={isUploading ? "Extracting text from PDF..." : "Paste medical report text here..."}
          disabled={isUploading}
          className="glass-input min-h-[120px] max-h-[40vh] w-full px-3 py-2 text-sm rounded-xl text-text placeholder:text-text-secondary resize-y overflow-y-auto disabled:opacity-50"
          aria-describedby={reportError ? 'report-error' : undefined}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload file"
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="text-xs text-accent hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {isUploading ? "Processing PDF..." : "Upload .txt or .pdf file"}
        </button>
        {reportError && (
          <p id="report-error" className="text-xs text-red-600" role="alert">
            {reportError}
          </p>
        )}
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="glass-btn px-3 py-2 text-sm font-medium rounded-xl text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!paste.trim() || isUploading}
          >
            {isUploading ? "Processing..." : "Analyze report"}
          </button>
        </div>
      </div>
    </div>
  );
}
