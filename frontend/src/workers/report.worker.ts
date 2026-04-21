import { expose } from 'comlink';

const reportWorkerApi = {
  normalizeReport(rawText: string) {
    // PERF: Heavy text normalization runs off the main thread.
    const text = typeof rawText === 'string' ? rawText : '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\u0000/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  },
};

expose(reportWorkerApi);
