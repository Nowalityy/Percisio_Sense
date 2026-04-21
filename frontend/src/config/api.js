function stripTrailingSlash(s) {
  return s.replace(/\/+$/, '');
}

const API_ORIGIN = stripTrailingSlash(
  import.meta.env.VITE_API_ORIGIN?.trim() ||
    (import.meta.env.DEV ? 'http://localhost:4000' : '')
);

export const CHAT_URL = `${API_ORIGIN}/chat`;
export const EXTRACT_PDF_URL = `${API_ORIGIN}/extract-pdf`;
