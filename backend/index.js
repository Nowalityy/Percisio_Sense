import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

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

function findDirectMatch(cleanText) {
  return SEGMENTS.find((segment) => {
    return cleanText === segment || cleanText.includes(segment) || cleanText.includes(segment.replace(/-/g, ' '));
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

  const clean = cleanText(text);

  const directMatch = findDirectMatch(clean);
  if (directMatch) {
    return directMatch;
  }

  const synonymMatch = findSynonymMatch(clean);
  if (synonymMatch) {
    return synonymMatch;
  }

  return findCategoryMatch(clean);
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
    model: process.env.OPENAI_MODEL || 'gpt-4o',
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
  await new Promise((resolve) => setTimeout(resolve, 600));

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
  const { message } = req.body || {};

  console.log(`📨 Received request: ${message?.substring(0, 50)}...`);

  if (typeof message !== 'string') {
    console.error('❌ Invalid message type:', typeof message);
    return res.status(400).json({ error: 'Message required' });
  }

  const detectedOrgan = extractOrgan(message);
  console.log(`🔍 Detected organ: ${detectedOrgan || 'none'}`);

  try {
    const result = openai
      ? await handleOpenAIRequest(message, detectedOrgan)
      : await handleMockRequest(message, detectedOrgan);

    return res.json(result);
  } catch (err) {
    console.error('OpenAI Error:', err);
    return res.status(500).json({ error: 'AI Error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(
    `📡 CORS: ${ALLOWED_ORIGINS ? `Restricted to: ${ALLOWED_ORIGINS.join(', ')}` : '✅ All localhost origins allowed (dev mode)'}`
  );
  console.log(`🤖 OpenAI API: ${openai ? '✅ Configured' : '⚠️ Mock mode (no API key)'}`);
});
