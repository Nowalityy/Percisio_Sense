import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : null; // null = allow all localhost origins in dev

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all localhost origins (any port)
    if (!ALLOWED_ORIGINS) {
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
    } else {
      // In production, check against allowed list
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
    }
    
    // Log blocked origins for debugging
    console.warn(`⚠️ CORS blocked origin: ${origin}`);
    if (ALLOWED_ORIGINS) {
      console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

if (!openai) {
  console.warn('⚠️ WARNING: OPENAI_API_KEY is missing. Running in MOCK mode.');
}

const SEGMENTS = [
  'aorta', 'brachiocephalic-trunk', 'esophagus', 'heart', 'inferior-lobe-of-left-lung',
  'inferior-lobe-of-right-lung', 'inferior-vena-cava', 'left-atrial-appendage',
  'left-brachiocephalic-vein', 'left-clavicle', 'left-common-carotid-artery',
  'left-deep-back-muscle', 'left-humerus', 'left-scapula', 'left-subclavian-artery',
  'liver', 'middle-lobe-of-right-lung', 'pancreas', 'portal-vein-and-splenic-vein',
  'pulmonary-venous-system', 'right-adrenal-gland', 'right-brachiocephalic-vein',
  'right-clavicle', 'right-common-carotid-artery', 'right-deep-back-muscle',
  'right-humerus', 'right-scapula', 'right-subclavian-artery', 'segment_1', 'spinal-cord',
  'spleen', 'sternum', 'stomach', 'superior-lobe-of-left-lung',
  'superior-lobe-of-right-lung', 'superior-vena-cava', 'thyroid', 'trachea'
];

const ORGAN_SYNONYMS = {
  'aorte': 'aorta',
  'foie': 'liver',
  'poumon': 'lung',
  'coeur': 'heart',
  'cœur': 'heart',
  'oesophage': 'esophagus',
  'œsophage': 'esophagus',
  'pancreas': 'pancreas',
  'rate': 'spleen',
  'estomac': 'stomach',
  'thyroide': 'thyroid',
  'trachee': 'trachea',
  'rein': 'kidney',
  'cerveau': 'brain',
  'clavicule': 'clavicle',
  'omoplate': 'scapula',
  'artere': 'artery',
  'veine': 'vein',
  'tronce': 'trunk',
  'pulmonaire': 'pulmonary',
  'thyroide': 'thyroid',
  'moelle': 'spinal',
  'vertèbre': 'spinal',
  'sternum': 'sternum',
  'estomac': 'stomach',
  'pancreas': 'pancreas',
  'rate': 'spleen'
};

const buildSystemPrompt = () => `
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

const extractOrgan = (text) => {
  const lower = (text || '').toLowerCase();
  
  // Try direct match with known segments
  const direct = SEGMENTS.find((s) => lower.includes(s));
  if (direct) return direct;

  // Try synonyms and return the English keyword
  for (const [syn, eng] of Object.entries(ORGAN_SYNONYMS)) {
    if (lower.includes(syn)) {
      return eng;
    }
  }

  return null;
};

/**
 * /chat: calls GPT-4o if API KEY available, else local mock.
 */
app.post('/chat', async (req, res) => {
  const { message } = req.body || {};
  
  // eslint-disable-next-line no-console
  console.log(`📨 Received request: ${message?.substring(0, 50)}...`);

  if (typeof message !== 'string') {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid message type:', typeof message);
    return res.status(400).json({ error: 'Message required' });
  }

  // extract potential focus from user message (fallback/hint)
  const detectedOrgan = extractOrgan(message);
  // eslint-disable-next-line no-console
  console.log(`🔍 Detected organ: ${detectedOrgan || 'none'}`);

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
      });

      const rawContent = completion.choices[0]?.message?.content?.trim();
      // eslint-disable-next-line no-console
      console.log('OpenAI Raw:', rawContent);

      let cleanContent = rawContent;
      // Handle the case where the model wraps JSON in markdown blocks
      if (cleanContent.includes('```json')) {
        cleanContent = cleanContent.split('```json')[1].split('```')[0].trim();
      } else if (cleanContent.includes('```')) {
        cleanContent = cleanContent.split('```')[1].split('```')[0].trim();
      }

      try {
        // Try parsing the cleaned content
        const parsed = JSON.parse(cleanContent);
        return res.json({
          reply: parsed.reply,
          focus: parsed.focus || null,
        });
      } catch (e) {
        // If parsing still fails, it might be partial JSON or plain text.
        // Try to find anything between { and }
        const braceMatch = rawContent.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try {
            const forcedParsed = JSON.parse(braceMatch[0]);
            return res.json({
              reply: forcedParsed.reply,
              focus: forcedParsed.focus || null,
            });
          } catch (e2) { /* nested fail, go to final fallback */ }
        }

        // Final fallback if JSON is truly broken: return as raw text but try to extract a focus key
        console.error('JSON Parse Error:', e);
        return res.json({
          reply: rawContent, 
          focus: detectedOrgan,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('OpenAI Error:', err);
      return res.status(500).json({ error: 'AI Error' });
    }
  } else {
    // MOCK MODE
    await new Promise((r) => setTimeout(r, 600)); // Latency sim
    return res.json({
      reply: `(Mock) I heard: "${message}". No API Key configured.`,
      focus: detectedOrgan,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`📡 CORS: ${ALLOWED_ORIGINS ? `Restricted to: ${ALLOWED_ORIGINS.join(', ')}` : '✅ All localhost origins allowed (dev mode)'}`);
  // eslint-disable-next-line no-console
  console.log(`🤖 OpenAI API: ${openai ? '✅ Configured' : '⚠️ Mock mode (no API key)'}`);
});
