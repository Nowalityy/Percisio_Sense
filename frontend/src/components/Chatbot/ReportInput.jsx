import { useState, useRef, useMemo, useEffect } from 'react';
import { wrap } from 'comlink';
import { useSceneStore } from '../../store';
import { EXTRACT_PDF_URL } from '../../config/api.js';

const MAX_FILE_SIZE_MB = 2;
/** Align with backend MAX_MESSAGE_LENGTH to avoid sending oversized content. */
const MAX_PASTE_LENGTH = 100_000;

/**
 * @param {{ embedded?: boolean }} props
 * When embedded, shows inline form (for tab panel). Otherwise "Add report" opens a modal overlay.
 */
export function ReportInput({ embedded = false }) {
  const [isOpen, setIsOpen] = useState(embedded);
  const [paste, setPaste] = useState('');
  const [reportError, setReportError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const setAnalyzedReport = useSceneStore((s) => s.setAnalyzedReport);
  const workerRef = useRef(null);

  const reportWorker = useMemo(() => {
    // PERF: Move text cleanup/parsing off the main thread.
    const worker = new Worker(new URL('../../workers/report.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    return wrap(worker);
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate?.();
    };
  }, []);

  const handleSubmit = async () => {
    const text = (await reportWorker.normalizeReport(paste)).trim();
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
    if (!embedded) setIsOpen(false);
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
        const res = await fetch(EXTRACT_PDF_URL, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to extract PDF');
        const normalized = await reportWorker.normalizeReport(data.text || '');
        setPaste(normalized);
      } catch (err) {
        setReportError(err.message);
      } finally {
        setIsUploading(false);
      }
    } else if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = async () => {
        const normalized = await reportWorker.normalizeReport(String(reader.result ?? ''));
        setPaste(normalized);
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

  const formBody = (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-dashed border-[var(--border-brand)] bg-[var(--brand-primary-light)] p-4 text-center"> {/* BRAND: #62C5EF */}
        <div className="mx-auto mb-2 size-9 rounded-lg border border-[var(--border-brand)] grid place-items-center text-[var(--brand-primary-dark)]"> {/* BRAND: #62C5EF */}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 16l5-5 5 5M12 11V3" />
            <path d="M4 17v2h16v-2" />
          </svg>
        </div>
        <p className="text-sm text-text">Drop radiology report here</p>
        <p className="text-xs text-text-secondary mt-1">or upload .txt / .pdf for parsing</p>
      </div>

      <textarea
        value={paste}
        onChange={(e) => {
          setPaste(e.target.value);
          setReportError(null);
        }}
        placeholder={isUploading ? 'Extracting text from PDF...' : 'Paste medical report text here...'}
        disabled={isUploading}
        className="glass-input min-h-[150px] max-h-[min(36vh,300px)] w-full px-3 py-3 text-sm resize-y overflow-y-auto disabled:opacity-50"
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
        className="glass-btn text-sm px-3 py-2 w-fit"
      >
        {isUploading ? 'Processing PDF...' : 'Upload .txt or .pdf file'}
      </button>
      {reportError && (
        <p id="report-error" className="text-[13px] text-red-300" role="alert">
          {reportError}
        </p>
      )}
      <div className="flex flex-wrap gap-2 shrink-0">
        {!embedded && (
          <button type="button" onClick={handleClose} className="glass-btn px-3 py-2 text-sm">
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3 text-sm font-semibold rounded-xl bg-[var(--brand-primary)] text-[var(--text-on-brand)] disabled:opacity-40 disabled:cursor-not-allowed shadow-[var(--shadow-md)]" // BRAND: #62C5EF
          disabled={!paste.trim() || isUploading}
        >
          {isUploading ? 'Processing...' : 'Analyze report'}
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-text mb-3">Report ingestion</h3>
        {formBody}
      </div>
    );
  }

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
    <div
      className="absolute inset-0 z-20 glass-panel flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 rounded-t-2xl">
        <h3 id="report-dialog-title" className="text-sm font-semibold text-text">
          Paste or upload report
        </h3>
        <button
          type="button"
          onClick={handleClose}
          className="glass-btn p-1.5 rounded-xl text-text-secondary hover:text-text transition-colors"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 gap-3 app-scrollbar">{formBody}</div>
    </div>
  );
}
