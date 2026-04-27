function stripTrailingSlash(s) {
  return s.replace(/\/+$/, '');
}

/**
 * When the UI is on Vercel but the API stays on Heroku, `POST /chat` on the
 * Vercel origin returns 405. Set `VITE_API_ORIGIN` in Vercel to override.
 */
const PRODUCTION_API_FALLBACK = 'https://percisio-frontend-5852dd243959.herokuapp.com';

const API_ORIGIN = stripTrailingSlash(
  import.meta.env.VITE_API_ORIGIN?.trim() ||
    (import.meta.env.DEV ? 'http://localhost:4000' : PRODUCTION_API_FALLBACK)
);

export const CHAT_URL = `${API_ORIGIN}/chat`;
export const EXTRACT_PDF_URL = `${API_ORIGIN}/extract-pdf`;
