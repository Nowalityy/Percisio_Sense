import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rateLimit } from 'express-rate-limit';
import { createRequire } from 'module';
import {
  sanitizeLlmFocus,
  extractVertebraFocusFromPlainText,
  FOCUS_KEYS as CANONICAL_FOCUS_KEYS,
} from './lib/focusSanitize.js';
import { chatRequestSchema } from './validation/chatSchemas.js';
import {
  hashReportContent,
  getExtractFindingsCached,
  setExtractFindingsCached,
} from './lib/findingsExtractCache.js';
import {
  getOpenAI,
  isModelConfigured,
  analyzeReport,
  streamChatReply,
  OPENAI_MODEL,
} from './lib/openaiClient.js';
import { logger, newRequestId } from './lib/logger.js';
import { dailyQuota } from './lib/quota.js';
import { sseEvent, SSE_DONE } from './lib/sse.js';

const require = createRequire(import.meta.url);
const fileUpload = require('express-fileupload');
const pdf = require('pdf-parse');

dotenv.config();

const DEFAULT_PORT = 4000;
const app = express();
const PORT = process.env.PORT || DEFAULT_PORT;

app.set('trust proxy', 1);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : null;

// ---------------------------------------------------------------------------
// 3D NAVIGATION (deterministic, safety boundary — NOT medical interpretation)
//
// Maps free-text organ mentions to the canonical 3D mesh keys so "show me the
// liver" / "zoom on C7" can drive the viewer without an LLM round-trip. This
// is infrastructure that must map to real assets; medical understanding is
// handled by the model (see lib/openaiClient.js).
// ---------------------------------------------------------------------------

const ORGAN_SYNONYMS = {
  aorte: 'aorta', foie: 'liver', poumon: 'lung', poumons: 'lung',
  'poumon gauche': 'left lung', 'poumon droit': 'right lung',
  coeur: 'heart', 'cœur': 'heart', oesophage: 'esophagus', 'œsophage': 'esophagus',
  pancreas: 'pancreas', rate: 'spleen', estomac: 'stomach', thyroide: 'thyroid', 'thyroïde': 'thyroid',
  trachee: 'trachea', 'trachée': 'trachea', rein: 'kidney', reins: 'kidney',
  cerveau: 'brain', clavicule: 'clavicle', clavicules: 'clavicle',
  omoplate: 'scapula', omoplates: 'scapula', artere: 'artery', 'artère': 'artery', 'artères': 'artery',
  veine: 'vein', veines: 'vein', tronc: 'trunk', pulmonaire: 'pulmonary',
  moelle: 'spinal-cord', 'moelle epiniere': 'spinal-cord', 'moelle épinière': 'spinal-cord',
  sternum: 'sternum', humerus: 'humerus', 'humérus': 'humerus', muscle: 'muscle', muscles: 'muscle',
  surrenale: 'adrenal', 'surrénales': 'adrenal', 'glande surrenale': 'adrenal', 'glande surrénale': 'adrenal',
  'rein gauche': 'left kidney', 'rein droit': 'right kidney', carotide: 'carotid', 'veine cave': 'vena cava',
};

const ORGAN_TO_SEGMENT_MAP = {
  'left kidney': 'left kidney', 'right kidney': 'right kidney',
  'left adrenal': 'left adrenal', 'right adrenal': 'right adrenal',
  'left lung': 'left lung', 'right lung': 'right lung',
  'urinary bladder': 'urinary bladder', 'small bowel': 'small bowel', 'portal vein': 'portal vein',
  'spinal-cord': 'spinal-cord', 'costal cartilage': 'costal cartilage',
  'cervical spine': 'cervical spine', 'thoracic spine': 'thoracic spine', 'lumbar spine': 'lumbar spine',
  'vena cava': 'vena cava', 'brachiocephalic vein': 'brachiocephalic vein',
  heart: 'heart', liver: 'liver', lung: 'lung', lungs: 'lung', stomach: 'stomach',
  pancreas: 'pancreas', spleen: 'spleen', thyroid: 'thyroid', trachea: 'trachea', esophagus: 'esophagus',
  aorta: 'aorta', clavicle: 'clavicle', scapula: 'scapula', humerus: 'humerus', muscle: 'muscle',
  iliopsoas: 'iliopsoas', carotid: 'carotid', subclavian: 'subclavian', artery: 'artery', vein: 'vein',
  vessel: 'vessel', pulmonary: 'pulmonary', sternum: 'sternum', adrenal: 'adrenal', colon: 'colon',
  duodenum: 'duodenum', gallbladder: 'gallbladder', bladder: 'bladder', prostate: 'prostate',
  bowel: 'small bowel', kidney: 'kidney', kidneys: 'kidney', skeleton: 'skeleton', bones: 'skeleton',
  brachiocephalic: 'brachiocephalic', trunk: 'trunk', mediastinum: 'mediastinum', diaphragm: 'diaphragm',
  pleura: 'pleura', iliac: 'iliac', femur: 'femur', hip: 'hip', gluteus: 'gluteus', rib: 'rib', ribs: 'ribs',
  vertebra: 'vertebra', vertebrae: 'vertebrae', sacrum: 'sacrum',
};

function cleanText(text) {
  return text.toLowerCase().trim().replace(/[.,!?;:]/g, ' ').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
}

function findDirectMatch(normalizedText) {
  return CANONICAL_FOCUS_KEYS.find((key) => {
    const k = key.replace(/-/g, ' ');
    return normalizedText === key || normalizedText === k || normalizedText.includes(key) || normalizedText.includes(k);
  });
}

function findSynonymMatch(clean) {
  for (const [synonym, english] of Object.entries(ORGAN_SYNONYMS)) {
    if (clean === synonym || clean.includes(synonym)) return ORGAN_TO_SEGMENT_MAP[english] || english;
  }
  return null;
}

function findCategoryMatch(clean) {
  for (const [category, segment] of Object.entries(ORGAN_TO_SEGMENT_MAP)) {
    if (clean.includes(category)) return segment;
  }
  return null;
}

function extractOrgan(text) {
  if (!text) return null;
  const vertebraKey = extractVertebraFocusFromPlainText(text);
  if (vertebraKey) {
    const safe = sanitizeLlmFocus(vertebraKey);
    if (safe) return safe;
  }
  const normalized = cleanText(text);
  return findDirectMatch(normalized) || findSynonymMatch(normalized) || findCategoryMatch(normalized);
}

const MAX_FOCUS_ONLY_MESSAGE_LENGTH = 120;

/** Patterns where the user only wants to navigate the viewer (no explanation). FR + EN. */
const FOCUS_ONLY_PATTERNS = [
  /\bzoom(e|er)?\s*(sur|sur le|sur la)?\b/i,
  /\bmontre(r)?\s*(moi)?\s*(le|la)?\b/i,
  /\b(de\s+|pour\s+|qu[e']?\s+)?me\s+montrer\s+(le|la|les)\b/i,
  /\baffiche(r)?\s*(le|la)?\b/i,
  /\bcentre(r)?\s*(sur|sur le|sur la)?\b/i,
  /\bva\s*(au|à la|sur)\b/i,
  /\b(peux-tu|puis-je|peut-on|stp|s'il te plaît)\s*(zoomer|montrer|afficher|focus|centrer)\b/i,
  /\bzoom\s*(in)?\s*(on|to)?\b/i,
  /\bfocus\s*(on|in)?\b/i,
  /\bcenter\s*(on)?\b/i,
  /\b(show|display)\s*(me)?\s*(the)?\b/i,
  /\bgo\s*to\s*(the)?\b/i,
  /\b(can you|could you|please)\s*(zoom|show|display|focus|center)\b/i,
  /\bpoint\s*(to|at)\s*(the)?\b/i,
  /\blook\s*at\s*(the)?\b/i,
  /\btake\s*me\s*to\s*(the)?\b/i,
];

/** Words indicating the user wants an explanation, not just navigation. FR + EN. */
const QUESTION_PATTERNS = [
  /\b(quoi|comment|pourquoi|explique|décris|informations|définition)\b/i,
  /\bqu'est-ce\s*(que|c'est)\b/i,
  /\bc'est\s+quoi\b/i,
  /\b(what|how|why|explain|describe|tell me about)\b/i,
];

function isFocusOnlyRequest(trimmed, detectedOrgan) {
  if (!detectedOrgan || trimmed.length > MAX_FOCUS_ONLY_MESSAGE_LENGTH) return false;
  const hasFocusIntent = FOCUS_ONLY_PATTERNS.some((re) => re.test(trimmed));
  const hasQuestionIntent = QUESTION_PATTERNS.some((re) => re.test(trimmed));
  return hasFocusIntent && !hasQuestionIntent;
}

/** Same marker as frontend CONTEXT_PROMPT_TEMPLATE — focus detection uses the user line, not the embedded report. */
const CONTEXT_USER_INQUIRY_MARKER = '[USER INQUIRY]:';
function getUserInquiryForShortcuts(message) {
  const idx = message.lastIndexOf(CONTEXT_USER_INQUIRY_MARKER);
  return idx === -1 ? message : message.slice(idx + CONTEXT_USER_INQUIRY_MARKER.length).trim();
}

// ---------------------------------------------------------------------------
// CHAT
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return `You are Percisio AI, a senior radiology assistant for a 3D medical imaging platform.

ROLE & TONE
- Professional, clinical, and concise. Lead with clinical substance; skip filler pleasantries.

GROUNDING & SAFETY
- When a report or context is provided, treat it as your single source of truth. Base every statement on it; never invent findings, measurements, or diagnoses that are not supported by the text.
- If the user asks about something the report does not cover, say so plainly instead of guessing.
- If no report is available, answer from general medical knowledge and clearly state that you do not have the patient's specific data.
- You are clinical decision support, not a replacement for a physician. The interface already shows a standing disclaimer, so DO NOT append a disclaimer block to your messages. Add at most one short inline caution only when a specific answer could be clinically misused.

LANGUAGE
- Always reply in clear, professional ENGLISH, even when the source report is in another language. Translate the clinically relevant content into English.

CONTEXT HANDLING
- The report may appear in an earlier turn or be embedded in the current message between markers. Use the whole conversation and prioritise the latest question.
- Never paste or reproduce the full report verbatim. Synthesise; quote at most one short, clinically essential phrase when needed.

ANSWERING THE QUESTION (most important)
- Answer the specific question that was actually asked. Do NOT restate, paraphrase, or re-list the whole report.
- "Explain / summarise the key findings" is a request for a brief synthesis of only the most clinically significant points plus the bottom line — typically 2–4 sentences, or a few tight bullets. It is NOT a request to reproduce every finding region by region.
- Lead with the direct answer or clinical bottom line, then add only the supporting detail the question needs.

RESPONSE STRUCTURE
- Use the full **Findings** / **Impression** / **Recommendations** structure ONLY when the user explicitly asks for the full report or a complete structured analysis.
- For everything else (including "explain the key findings"), reply in concise prose or a short focused list — do not force the full structure.`;
}

/** system + prior turns + latest user line, for chat completions. */
function buildOpenAIMessages(priorTurns, latestUserMessage) {
  const messages = [{ role: 'system', content: buildSystemPrompt() }];
  for (const turn of Array.isArray(priorTurns) ? priorTurns : []) {
    const role = turn?.role;
    const content = typeof turn?.content === 'string' ? turn.content : '';
    if (!content.trim() || (role !== 'user' && role !== 'assistant')) continue;
    messages.push({ role, content });
  }
  messages.push({ role: 'user', content: latestUserMessage });
  return messages;
}

function mockReply(latestMessage, detectedOrgan) {
  if (detectedOrgan) {
    return `(AI model not configured.) You referenced **${detectedOrgan}**. Configure OPENAI_API_KEY to receive a grounded clinical answer.`;
  }
  const preview = typeof latestMessage === 'string' && latestMessage.length > 160
    ? `${latestMessage.slice(0, 160)}…`
    : latestMessage ?? '';
  return `(AI model not configured.) Received: "${preview}". Set OPENAI_API_KEY to enable clinical responses.`;
}

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Build the findings/risks cards the frontend report panel consumes. */
function buildCardsFromBundle(bundle) {
  const byOrgan = bundle?.byOrgan ?? {};
  const entries = Object.entries(byOrgan);
  const capped = entries.length > 8
    ? entries.sort((a, b) => b[1].length - a[1].length).slice(0, 8)
    : entries;
  const cards = capped.map(([organName, lines]) => ({
    title: titleCase(organName),
    content: (Array.isArray(lines) ? lines : []).map((l) => `- ${l}`).join('\n'),
  }));

  const flags = Array.isArray(bundle?.riskFlags) ? bundle.riskFlags : [];
  if (flags.length > 0) {
    const riskContent = flags.map((f) => `- [${f.level ?? 'risk'}] ${f.text ?? ''}`).join('\n');
    cards.push({ id: 'card-risks', title: 'Risks', content: riskContent });
  }
  return cards;
}

/** Structured analysis for a report, cached by content. MCP first, direct fallback. */
async function getAnalysisBundle(reportText, log = logger) {
  const key = hashReportContent(reportText);
  const cached = getExtractFindingsCached(key);
  if (cached) return { bundle: cached, source: 'cache' };

  let bundle;
  let source;
  try {
    const { callTool } = await import('./mcp/client.js');
    bundle = await callTool('extract_findings', { reportText });
    source = bundle?._source || 'mcp';
  } catch (mcpErr) {
    log.warn('MCP extract_findings failed, analyzing directly', { cause: mcpErr?.message ?? String(mcpErr) });
    const direct = await analyzeReport(reportText, log);
    bundle = direct.bundle;
    source = direct.source;
  }
  setExtractFindingsCached(key, bundle);
  return { bundle, source };
}

// ---------------------------------------------------------------------------
// MIDDLEWARE
// ---------------------------------------------------------------------------

function isLocalhostOrigin(origin) {
  return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
}

function handleCorsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (!ALLOWED_ORIGINS) {
    if (isLocalhostOrigin(origin)) return callback(null, true);
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }
  logger.warn('CORS blocked origin', { origin });
  callback(new Error('Not allowed by CORS'));
}

app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: handleCorsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

/** Burst limiter: short-window protection against rapid-fire requests. */
const chatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** Daily per-IP quota: caps total spend per client over 24h (USER_DAILY_QUOTA). */
const chatDailyQuota = dailyQuota({ log: logger });

app.use(express.json({ limit: '256kb' }));

const pdfUploadMiddleware = fileUpload({
  limits: { fileSize: 2 * 1024 * 1024 },
  abortOnLimit: true,
});

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    model: isModelConfigured() ? OPENAI_MODEL : null,
    mode: isModelConfigured() ? 'live' : 'offline',
  });
});

/** Extract text from a medical scan PDF. */
app.post('/extract-pdf', chatRateLimit, chatDailyQuota, pdfUploadMiddleware, async (req, res) => {
  try {
    if (!req.files || !req.files.report) {
      return res.status(400).json({ error: 'No PDF file uploaded. Use parameter name "report".' });
    }
    const pdfFile = req.files.report;
    if (pdfFile.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Invalid file type. Only PDF is supported.' });
    }
    if (pdfFile.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Max 2MB allowed.' });
    }
    const data = await pdf(pdfFile.data);
    const extractedText = data.text || '';
    if (!extractedText.trim()) {
      return res.status(422).json({ error: 'Could not extract text from this PDF. It might be an image-only scan.' });
    }
    res.json({ text: extractedText });
  } catch (err) {
    logger.error('PDF extraction error', { cause: err?.message ?? String(err) });
    res.status(500).json({ error: 'Internal server error during PDF processing.' });
  }
});

if (!isModelConfigured()) {
  logger.warn('OPENAI_API_KEY missing — running in OFFLINE mode (no clinical analysis)');
}

/**
 * Streaming chat (Server-Sent Events).
 * Frames: {type:'delta',text} for reply tokens, then one
 * {type:'final', focus, cards?, impression?, recommendations?, meta} frame,
 * then the literal `[DONE]`. Errors arrive as {type:'error', message}.
 */
app.post('/chat', chatRateLimit, chatDailyQuota, async (req, res) => {
  const requestId = newRequestId();
  res.setHeader('X-Request-Id', requestId);
  const log = logger.child({ requestId, route: '/chat' });

  const parsedBody = chatRequestSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    const first = parsedBody.error.issues[0];
    log.warn('invalid request body', { issue: first?.message });
    return res.status(400).json({ error: first?.message ?? 'Invalid request body' });
  }

  const { message: trimmed, reportText, history: requestHistory } = parsedBody.data;
  const priorTurns = Array.isArray(requestHistory) ? requestHistory : [];
  const userInquiry = getUserInquiryForShortcuts(trimmed);
  const detectedOrgan = extractOrgan(userInquiry);
  const reportTextStr =
    typeof reportText === 'string' && reportText.trim().length > 0 ? reportText.trim() : null;
  const startedAt = Date.now();

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (obj) => res.write(sseEvent(obj));
  log.info('chat request', {
    hasReport: Boolean(reportTextStr),
    historyTurns: priorTurns.length,
    detectedOrgan: detectedOrgan ?? null,
  });

  try {
    // Kick off the structured analysis concurrently so cards are ready by the
    // time the streamed reply finishes (first report load only; cached after).
    const analysisPromise = reportTextStr
      ? getAnalysisBundle(reportTextStr, log).catch((err) => {
          log.warn('analysis failed', { cause: err?.message ?? String(err) });
          return null;
        })
      : null;

    // 1) Reply text (streamed).
    let usage = null;
    let mode = 'model';
    if (isFocusOnlyRequest(userInquiry, detectedOrgan)) {
      mode = 'focus-only';
    } else if (isModelConfigured()) {
      const result = await streamChatReply(
        buildOpenAIMessages(priorTurns, trimmed),
        (delta) => send({ type: 'delta', text: delta }),
        log
      );
      usage = result.usage;
    } else {
      mode = 'offline';
      send({ type: 'delta', text: mockReply(trimmed, detectedOrgan) });
    }

    // 2) Final frame: focus + (when a report is present) structured panel data.
    const finalFrame = { type: 'final' };
    const focus = sanitizeLlmFocus(detectedOrgan);
    if (focus) finalFrame.focus = focus;

    let analysisSource = null;
    if (analysisPromise) {
      const analysis = await analysisPromise;
      if (analysis?.bundle) {
        finalFrame.cards = buildCardsFromBundle(analysis.bundle);
        if (typeof analysis.bundle.impression === 'string') {
          finalFrame.impression = analysis.bundle.impression;
        }
        if (Array.isArray(analysis.bundle.recommendations)) {
          finalFrame.recommendations = analysis.bundle.recommendations;
        }
        analysisSource = analysis.source;
        finalFrame.meta = { analysisSource };
      } else {
        finalFrame.cards = [];
      }
    }

    send(finalFrame);
    res.write(SSE_DONE);
    res.end();
    log.info('chat complete', {
      mode,
      durationMs: Date.now() - startedAt,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      analysisSource,
      cards: finalFrame.cards?.length,
    });
  } catch (err) {
    log.error('chat error', { cause: err?.message ?? String(err), durationMs: Date.now() - startedAt });
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    send({ type: 'error', message: 'The assistant failed to respond. Please try again.' });
    res.end();
  }
});

// ---------------------------------------------------------------------------
// STATIC (production monolith) + STARTUP
// ---------------------------------------------------------------------------

const APP_MODE = process.env.APP_MODE || 'monolithic';
if (process.env.NODE_ENV === 'production' && APP_MODE !== 'backend') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.join(__dirname, '..', 'frontend', 'dist');
  if (existsSync(distDir)) {
    app.use(
      express.static(distDir, {
        maxAge: '30d',
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    app.get(/^\/(?!chat$|extract-pdf$|health$|api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    logger.info('frontend/dist not found — running in API-only mode');
  }
}

// Warm the OpenAI client (validates config path) without a network call.
getOpenAI();

app.listen(PORT, '0.0.0.0', () => {
  logger.info('backend started', {
    port: PORT,
    cors: ALLOWED_ORIGINS ? ALLOWED_ORIGINS.join(',') : 'localhost-dev',
    openai: isModelConfigured() ? OPENAI_MODEL : 'offline',
  });
  void import('./mcp/client.js')
    .then(({ init }) => init())
    .then(() => logger.info('MCP subprocess ready (warm)'))
    .catch((err) => logger.warn('MCP warm-up deferred until first /chat with report', { cause: err?.message ?? String(err) }));
});
