import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const DEFAULT_PORT = 4000;
const MAX_MESSAGE_LENGTH = 100_000;
const MAX_REPORT_TEXT_LENGTH = 100_000;
const MOCK_DELAY_MS = 600;
const OPENAI_MODEL_DEFAULT = 'gpt-4o';
const LOG_MESSAGE_PREFIX_LENGTH = 50;

const app = express();
const PORT = process.env.PORT || DEFAULT_PORT;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : null;

const SEGMENTS = [
  'aorta',
  'brachiocephalic-trunk',
  'esophagus',
  'heart',
  'inferior-lobe-of-left-lung',
  'inferior-lobe-of-right-lung',
  'inferior-vena-cava',
  'left-atrial-appendage',
  'left-brachiocephalic-vein',
  'left-clavicle',
  'left-common-carotid-artery',
  'left-deep-back-muscle',
  'left-humerus',
  'left-scapula',
  'left-subclavian-artery',
  'liver',
  'middle-lobe-of-right-lung',
  'pancreas',
  'portal-vein-and-splenic-vein',
  'pulmonary-venous-system',
  'right-adrenal-gland',
  'right-brachiocephalic-vein',
  'right-clavicle',
  'right-common-carotid-artery',
  'right-deep-back-muscle',
  'right-humerus',
  'right-scapula',
  'right-subclavian-artery',
  'segment_1',
  'spinal-cord',
  'spleen',
  'sternum',
  'stomach',
  'superior-lobe-of-left-lung',
  'superior-lobe-of-right-lung',
  'superior-vena-cava',
  'thyroid',
  'trachea',
];

const ORGAN_SYNONYMS = {
  aorte: 'aorta',
  foie: 'liver',
  poumon: 'lung',
  poumons: 'lung',
  coeur: 'heart',
  cœur: 'heart',
  oesophage: 'esophagus',
  œsophage: 'esophagus',
  pancreas: 'pancreas',
  rate: 'spleen',
  estomac: 'stomach',
  thyroide: 'thyroid',
  thyroïde: 'thyroid',
  trachee: 'trachea',
  trachée: 'trachea',
  rein: 'kidney',
  reins: 'kidney',
  cerveau: 'brain',
  clavicule: 'clavicle',
  clavicules: 'clavicle',
  omoplate: 'scapula',
  omoplates: 'scapula',
  artere: 'artery',
  artère: 'artery',
  artères: 'artery',
  veine: 'vein',
  veines: 'vein',
  tronce: 'trunk',
  tronc: 'trunk',
  pulmonaire: 'pulmonary',
  moelle: 'spinal-cord',
  'moelle epiniere': 'spinal-cord',
  'moelle épinière': 'spinal-cord',
  vertèbre: 'spinal-cord',
  vertèbres: 'spinal-cord',
  sternum: 'sternum',
  humerus: 'humerus',
  humérus: 'humerus',
  muscle: 'muscle',
  muscles: 'muscle',
  surrenale: 'adrenal',
  surrénales: 'adrenal',
  'glande surrenale': 'adrenal',
  'glande surrénale': 'adrenal',
};

const ORGAN_TO_SEGMENT_MAP = {
  heart: 'heart',
  liver: 'liver',
  lung: 'lung',
  stomach: 'stomach',
  pancreas: 'pancreas',
  spleen: 'spleen',
  thyroid: 'thyroid',
  trachea: 'trachea',
  esophagus: 'esophagus',
  aorta: 'aorta',
  clavicle: 'clavicle',
  scapula: 'scapula',
  humerus: 'humerus',
  muscle: 'muscle',
  artery: 'artery',
  vein: 'vein',
  pulmonary: 'pulmonary',
  'spinal-cord': 'spinal-cord',
  sternum: 'sternum',
  adrenal: 'adrenal',
};

function buildSystemPrompt() {
  return `
You are a Senior Radiologist with 20 years of clinical experience.
You specialize in:
- Medical imaging (CT, MRI, X-Ray, Ultrasound)
- Accurate diagnostics
- Patient safety and ethics

CONTEXT RULES:
- If the user message contains "[CONTEXT - ANALYZED DOCUMENT]" followed by report text, base your answer on that document and the question that follows.
- If the user message is a short question with no such header, the user has not uploaded a report: answer from general knowledge only; do not refer to or invent a specific report.

Instructions:
- Keep answers concise, professional, and medically accurate
- Output must always be valid JSON
- Output MUST be a JSON object with "reply" and "focus" keys.

MANDATORY OUTPUT FORMAT (JSON ONLY):
{
  "reply": "Your final response text here (formatted in markdown).",
  "focus": "name_of_organ_or_null"
}

3D FOCUS LOGIC:
- If the user asks about a specific anatomical structure, set "focus" to its EXACT name from this list:
${SEGMENTS.join(', ')}
- CATEGORY VIEW: If the user asks for a general organ that has multiple parts (like "lungs", "veins", "bones", "muscles"), you can use a broad keyword like "lung", "vein", "clavicle", "scapula", "artery", "trunk", "muscle" to focus on all related segments at once.
- Example: "focus": "lung" will zoom on all lung lobes.
- If no specific segment or category matches, set "focus": null.
`;
}

function cleanText(text) {
  return text.toLowerCase().trim().replace(/[.,!?;:]/g, ' ');
}

function findDirectMatch(normalizedText) {
  return SEGMENTS.find((segment) => {
    return (
      normalizedText === segment ||
      normalizedText.includes(segment) ||
      normalizedText.includes(segment.replace(/-/g, ' '))
    );
  });
}

function findSynonymMatch(cleanText) {
  for (const [synonym, english] of Object.entries(ORGAN_SYNONYMS)) {
    if (cleanText === synonym || cleanText.includes(synonym)) {
      return ORGAN_TO_SEGMENT_MAP[english] || english;
    }
  }
  return null;
}

function findCategoryMatch(cleanText) {
  for (const [category, segment] of Object.entries(ORGAN_TO_SEGMENT_MAP)) {
    if (cleanText.includes(category)) {
      return segment;
    }
  }
  return null;
}

function extractOrgan(text) {
  if (!text) {
    return null;
  }

  const normalized = cleanText(text);

  const directMatch = findDirectMatch(normalized);
  if (directMatch) {
    return directMatch;
  }

  const synonymMatch = findSynonymMatch(normalized);
  if (synonymMatch) {
    return synonymMatch;
  }

  return findCategoryMatch(normalized);
}

/** Max length for treating a message as "only zoom/focus on organ" (no LLM reply). */
const MAX_FOCUS_ONLY_MESSAGE_LENGTH = 120;

/** Patterns that indicate the user only wants to focus/zoom on an organ (no explanation). FR + EN. */
const FOCUS_ONLY_PATTERNS = [
  // French
  /\bzoom(e|er)?\s*(sur|sur le|sur la)?\b/i,
  /\bmontre(r)?\s*(moi)?\s*(le|la)?\b/i,
  /\baffiche(r)?\s*(le|la)?\b/i,
  /\bcentre(r)?\s*(sur|sur le|sur la)?\b/i,
  /\bva\s*(au|à la|sur)\b/i,
  /\b(peux-tu|puis-je|peut-on|stp|s'il te plaît)\s*(zoomer|montrer|afficher|focus|centrer)\b/i,
  /\b(zoomer|montrer|afficher|focus)\s*(stp|s'il te plaît)\b/i,
  // English
  /\bzoom\s*(in)?\s*(on|to)?\b/i,
  /\bfocus\s*(on|in)?\b/i,
  /\bcenter\s*(on)?\b/i,
  /\b(show|display)\s*(me)?\s*(the)?\b/i,
  /\bgo\s*to\s*(the)?\b/i,
  /\b(can you|could you|please)\s*(zoom|show|display|focus|center)\b/i,
  /\b(zoom|show|display|focus)\s*(please)\b/i,
  /\bpoint\s*(to|at)\s*(the)?\b/i,
  /\blook\s*at\s*(the)?\b/i,
  /\btake\s*me\s*to\s*(the)?\b/i,
];

/** Words that indicate the user wants an explanation, not just navigation. FR + EN. */
const QUESTION_PATTERNS = [
  /\b(quoi|comment|pourquoi|explique|décris|informations|définition)\b/i,
  /\bqu'est-ce\s*(que|c'est)\b/i,
  /\bc'est\s+quoi\b/i,
  /\b(what|how|why|explain|describe|tell me about)\b/i,
];

/**
 * Returns true when the message is only asking to zoom/focus on an organ (no medical question).
 * In that case we return empty reply + focus action so the UI does not show a redundant text answer.
 */
function isFocusOnlyRequest(trimmed, detectedOrgan) {
  if (!detectedOrgan || trimmed.length > MAX_FOCUS_ONLY_MESSAGE_LENGTH) {
    return false;
  }
  const hasFocusIntent = FOCUS_ONLY_PATTERNS.some((re) => re.test(trimmed));
  const hasQuestionIntent = QUESTION_PATTERNS.some((re) => re.test(trimmed));
  return hasFocusIntent && !hasQuestionIntent;
}

/** Organ detection: canonical name -> regex (word boundary). */
const REPORT_ORGAN_PATTERNS = [
  ['lungs', /\b(lung|lungs|pulmonary|pleura|pleural)\b/gi],
  ['heart', /\b(heart|cardiac|atrium|ventricle|pericardium)\b/gi],
  ['liver', /\b(liver|hepatic)\b/gi],
  ['bones', /\b(bone|skeleton|spine|vertebra|clavicle|scapula|humerus|sternum|rib)\b/gi],
  ['vessels', /\b(aorta|artery|vein|vessel|vascular|IVC|SVC)\b/gi],
  ['pleura', /\b(pleura|pleural)\b/gi],
  ['mediastinum', /\b(mediastinum|mediastinal)\b/gi],
  ['diaphragm', /\b(diaphragm)\b/gi],
  ['kidney', /\b(kidney|renal)\b/gi],
  ['spleen', /\b(spleen|splenic)\b/gi],
  ['pancreas', /\b(pancreas|pancreatic)\b/gi],
  ['stomach', /\b(stomach|gastric)\b/gi],
  ['thyroid', /\b(thyroid)\b/gi],
  ['brain', /\b(brain|cerebral)\b/gi],
  ['spinal cord', /\b(spinal\s*cord|spine)\b/gi],
  ['esophagus', /\b(esophagus|oesophagus)\b/gi],
  ['trachea', /\b(trachea|tracheal)\b/gi],
];
const ANOMALY_KEYWORDS = /\b(nodule|mass|lesion|effusion|atelectasis|consolidation|enlarged|dilation|dilatation|fracture|embolism|pneumothorax|thickening|opacity|infiltrate|edema|stenosis|abnormal|pathology|enlargement)\b/gi;

/** Line-by-line extraction grouped by organ. Returns { byOrgan: { [organName]: string[] } }. Max 8 organs. */
function extractFindings(reportText) {
  if (!reportText || typeof reportText !== 'string') {
    return { byOrgan: {} };
  }
  const byOrgan = Object.create(null);
  const lines = reportText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const hasAnomaly = ANOMALY_KEYWORDS.test(line);
    ANOMALY_KEYWORDS.lastIndex = 0;
    if (!hasAnomaly) continue;

    for (const [organName, re] of REPORT_ORGAN_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line)) {
        if (!byOrgan[organName]) byOrgan[organName] = [];
        const trimmed = line.slice(0, 300);
        if (!byOrgan[organName].includes(trimmed)) byOrgan[organName].push(trimmed);
        break;
      }
    }
  }

  const keys = Object.keys(byOrgan);
  if (keys.length > 8) {
    const sorted = keys.sort((a, b) => byOrgan[b].length - byOrgan[a].length).slice(0, 8);
    const trimmed = Object.create(null);
    for (const k of sorted) trimmed[k] = byOrgan[k];
    return { byOrgan: trimmed };
  }
  return { byOrgan };
}

/** Case-insensitive evidence highlight. Exact match else first line containing any needle word (>= 3 chars). */
function highlightEvidence(reportText, needle) {
  if (!reportText || typeof reportText !== 'string') {
    return { quote: '', start: -1, end: -1 };
  }
  if (!needle || typeof needle !== 'string') {
    return { quote: '', start: -1, end: -1 };
  }
  const lower = reportText.toLowerCase();
  const needleLower = needle.toLowerCase().trim();
  const exactIndex = lower.indexOf(needleLower);
  if (exactIndex !== -1) {
    return {
      quote: reportText.slice(exactIndex, exactIndex + needle.length),
      start: exactIndex,
      end: exactIndex + needle.length,
    };
  }
  const lines = reportText.split(/\r?\n/);
  const words = needleLower.split(/\s+/).filter((w) => w.length >= 3);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(needleLower)) {
      const line = lines[i];
      const lineStart = lines.slice(0, i).join('\n').length;
      return { quote: line, start: lineStart, end: lineStart + line.length };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    if (words.some((w) => lineLower.includes(w))) {
      const line = lines[i];
      const lineStart = lines.slice(0, i).join('\n').length;
      return { quote: line, start: lineStart, end: lineStart + line.length };
    }
  }
  return { quote: '', start: -1, end: -1 };
}

/** Lightweight runtime validation: ensure every response has strict shape. */
function validateChatResponse(payload) {
  const answer = typeof payload.answer === 'string' ? payload.answer : '';
  const rawCards = Array.isArray(payload.cards) ? payload.cards : [];
  const cards = rawCards.map((c, i) => ({
    id: typeof c.id === 'string' ? c.id : `card-${i}`,
    title: typeof c.title === 'string' ? c.title : 'Finding',
    content: typeof c.content === 'string' ? c.content : (c.text != null ? String(c.text) : ''),
  }));
  const rawActions = Array.isArray(payload.uiActions) ? payload.uiActions : [];
  const uiActions = rawActions.filter(
    (a) => a && a.type === 'FOCUS_ORGAN' && typeof a.organ === 'string'
  );
  return { answer, cards, uiActions };
}

/** Strict API shape: { answer, cards, uiActions } (+ optional _meta). uiActions type exactly "FOCUS_ORGAN". */
function toResponse(result, cards = [], meta = null) {
  const uiActions = [];
  if (result.focus && typeof result.focus === 'string') {
    uiActions.push({ type: 'FOCUS_ORGAN', organ: result.focus });
  }
  const normalizedCards = (Array.isArray(cards) ? cards : []).map((c, i) => ({
    id: c.id ?? `card-${i}`,
    title: typeof c.title === 'string' ? c.title : 'Finding',
    content: typeof c.content === 'string' ? c.content : (c.text != null ? String(c.text) : ''),
  }));
  const payload = validateChatResponse({
    answer: result.reply != null ? String(result.reply) : '',
    cards: normalizedCards,
    uiActions,
  });
  if (meta && typeof meta === 'object') {
    payload._meta = meta;
  }
  return payload;
}

function isLocalhostOrigin(origin) {
  return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
}

function handleCorsOrigin(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }

  if (!ALLOWED_ORIGINS) {
    if (isLocalhostOrigin(origin)) {
      return callback(null, true);
    }
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }

  console.warn(`⚠️ CORS blocked origin: ${origin}`);
  if (ALLOWED_ORIGINS) {
    console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  }
  callback(new Error('Not allowed by CORS'));
}

function extractJsonFromMarkdown(content) {
  if (content.includes('```json')) {
    return content.split('```json')[1].split('```')[0].trim();
  }
  if (content.includes('```')) {
    return content.split('```')[1].split('```')[0].trim();
  }
  return content;
}

function parseJsonResponse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function handleOpenAIRequest(message, detectedOrgan) {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || OPENAI_MODEL_DEFAULT,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: message },
    ],
    temperature: 0.7,
  });

  const rawContent = completion.choices[0]?.message?.content?.trim();
  const cleanContent = extractJsonFromMarkdown(rawContent);
  const parsed = parseJsonResponse(cleanContent);

  if (parsed) {
    return {
      reply: parsed.reply,
      focus: parsed.focus || null,
    };
  }

  return {
    reply: rawContent,
    focus: detectedOrgan,
  };
}

async function handleMockRequest(message, detectedOrgan) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  const mockReply = detectedOrgan
    ? `(Mock) Vous avez mentionné l'organe: ${detectedOrgan}. Voici des informations sur cet organe.`
    : `(Mock) I heard: "${message}". No API Key configured.`;

  return {
    reply: mockReply,
    focus: detectedOrgan,
  };
}

app.use(
  cors({
    origin: handleCorsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

if (!openai) {
  console.warn('⚠️ WARNING: OPENAI_API_KEY is missing. Running in MOCK mode.');
}

app.post('/chat', async (req, res) => {
  const { message, reportText } = req.body ?? {};

  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'Message required' });
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'Message must not be empty' });
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message must not exceed ${MAX_MESSAGE_LENGTH} characters`,
    });
  }

  const prefix =
    trimmed.length <= LOG_MESSAGE_PREFIX_LENGTH
      ? trimmed
      : trimmed.substring(0, LOG_MESSAGE_PREFIX_LENGTH) + '…';
  console.log(`📨 Request length=${trimmed.length} prefix="${prefix}"`);

  const detectedOrgan = extractOrgan(trimmed);
  console.log(`🔍 Detected organ: ${detectedOrgan ?? 'none'}`);

  try {
    let result;
    if (isFocusOnlyRequest(trimmed, detectedOrgan)) {
      console.log('🎯 Focus-only request: empty reply + focus', detectedOrgan);
      result = { reply: '', focus: detectedOrgan };
    } else if (openai) {
      try {
        result = await handleOpenAIRequest(trimmed, detectedOrgan);
      } catch (apiErr) {
        console.warn(
          'OpenAI API error (e.g. quota), falling back to mock:',
          apiErr.message ?? apiErr.code
        );
        result = await handleMockRequest(trimmed, detectedOrgan);
      }
    } else {
      result = await handleMockRequest(trimmed, detectedOrgan);
    }

    // reportText is sent by the client for both: (1) first message when a report is loaded, (2) any follow-up message while a report is in context
    const reportTextStr =
      typeof reportText === 'string' && reportText.trim().length > 0 ? reportText.trim() : null;
    let cards = [];
    let responseMeta = null;

    if (reportTextStr) {
      if (reportTextStr.length > MAX_REPORT_TEXT_LENGTH) {
        console.warn('[backend] reportText exceeds max length, using local fallback (size:', reportTextStr.length, ')');
        const { byOrgan } = extractFindings(reportTextStr);
        cards = Object.entries(byOrgan).map(([organName, lines]) => ({
          title: organName.charAt(0).toUpperCase() + organName.slice(1),
          content: lines.map((l) => `- ${l}`).join('\n'),
        }));
        responseMeta = { cardsFrom: 'fallback' };
      } else {
        try {
          const { callTool } = await import('./mcp/client.js');
          const out = await callTool('extract_findings', { reportText: reportTextStr });
          console.log('[backend] MCP extract_findings OK, cards from MCP server');
          const byOrgan = out?.byOrgan ?? {};
          const entries = Object.entries(byOrgan);
          const capped = entries.length > 8 ? entries.sort((a, b) => b[1].length - a[1].length).slice(0, 8) : entries;
          cards = capped.map(([organName, lines]) => ({
            title: organName.charAt(0).toUpperCase() + organName.slice(1),
            content: (Array.isArray(lines) ? lines : []).map((l) => `- ${l}`).join('\n'),
          }));

          try {
            const flagsOut = await callTool('risk_flags', { byOrgan });
            const flags = Array.isArray(flagsOut?.flags) ? flagsOut.flags : [];
            if (flags.length > 0) {
              const riskContent = flags.map((f) => `- [${f.level ?? 'risk'}] ${f.text ?? ''}`).join('\n');
              cards.push({ id: 'card-risks', title: 'Risks', content: riskContent });
            }
          } catch (riskErr) {
            console.warn('MCP risk_flags failed, continuing without risks card:', riskErr?.message ?? riskErr);
          }
        } catch (mcpErr) {
          console.warn('MCP extract_findings failed, using local fallback:', mcpErr?.message ?? mcpErr);
          const { byOrgan } = extractFindings(reportTextStr);
          cards = Object.entries(byOrgan).map(([organName, lines]) => ({
            title: organName.charAt(0).toUpperCase() + organName.slice(1),
            content: lines.map((l) => `- ${l}`).join('\n'),
          }));
          responseMeta = { cardsFrom: 'fallback' };
        }
      }
    }

    return res.json(toResponse(result, cards, responseMeta));
  } catch (err) {
    console.error('Chat error:', err.message ?? err);
    return res.status(500).json(validateChatResponse({ answer: '', cards: [], uiActions: [] }));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(
    `📡 CORS: ${ALLOWED_ORIGINS ? `Restricted to: ${ALLOWED_ORIGINS.join(', ')}` : '✅ All localhost origins allowed (dev mode)'}`
  );
  console.log(`🤖 OpenAI API: ${openai ? '✅ Configured' : '⚠️ Mock mode (no API key)'}`);
});
