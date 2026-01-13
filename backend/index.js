import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 4000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const organKeywords = ['foie', 'poumon', 'rein', 'cerveau', 'coeur'];

app.use(cors());
app.use(express.json());

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const buildSystemPrompt = () => `
Tu es "Percisio Insight", un assistant médical expert en radiologie et médecine interne.
Ton rôle est d'analyser des contextes médicaux et de répondre aux questions avec précision, professionnalisme et clarté.

RÈGLES DE RÉPONSE :
1. ANALYSE : Si on te donne un rapport, identifie chaque anomalie et classe-les par importance.
2. STRUCTURE : Utilise du Markdown pour formater ta réponse (gras pour les termes clés, listes à puces pour la lisibilité).
3. TON : Sois empathique mais factuel. Vulgarise les termes complexes si nécessaire.
4. SYNTHÈSE : Ne sois pas trop verbeux, mais sois complet sur les points critiques.

FORMAT DE SORTIE OBLIGATOIRE (JSON SEULEMENT) :
Réponds UNIQUEMENT avec cet objet JSON, sans rien autour :
{
  "reply": "Ton texte de réponse ici (formaté en markdown).",
  "focus": "foie|poumon|rein|cerveau|coeur|null"
}

LOGIQUE DE FOCUS 3D :
- Si l'utilisateur pose une question spécifique sur un organe ou si le rapport signale une anomalie MAJEURE sur un organe précis, mets son nom dans "focus".
- Sinon, mets "focus": null.
`;

const extractOrgan = (text) => {
  const lower = (text || '').toLowerCase();
  return organKeywords.find((k) => lower.includes(k)) || null;
};

/**
 * /chat : appelle GPT-4o si API KEY dispo, sinon mock local.
 */
app.post('/chat', async (req, res) => {
  const { message } = req.body || {};

  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'message must be a string' });
  }

  // Fallback mock si pas de clé
  if (!openaiClient) {
    const foundOrgan = extractOrgan(message);
    let reply = 'Voici un résumé général du scanner :\n';
    reply += '- Structures principales visibles.\n';
    reply += '- Aucune anomalie majeure détectée dans cette simulation.\n';
    if (foundOrgan) {
      reply += `\nJ'ai détecté que vous vous intéressez au ${foundOrgan}. Je vais centrer la vue dessus.`;
    }
    return res.json({ reply, focus: foundOrgan });
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: `Message utilisateur: """${message}"""`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content;
    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (err) {
      parsed = null;
    }

    const fallbackReply =
      'Résumé non structuré disponible. Veuillez reformuler votre demande.';

    const reply = parsed?.reply || fallbackReply;
    const focusRaw = parsed?.focus || extractOrgan(message) || null;
    const focus = organKeywords.includes(focusRaw) ? focusRaw : null;

    return res.json({ reply, focus });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({
      error: 'openai_error',
      message: 'Erreur lors de l’appel OpenAI.',
    });
  }
});

app.get('/', (_req, res) => {
  res.json({ status: 'ok', model: OPENAI_MODEL, openai: !!openaiClient });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API listening on http://localhost:${PORT}`);
});

