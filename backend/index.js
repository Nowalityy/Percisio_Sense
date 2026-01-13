const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const buildSystemPrompt = () => `
You are "Percisio Sense", an expert medical assistant in radiology and internal medicine.
Your role is to analyze medical contexts and answer questions with precision, professionalism, and clarity.

RESPONSE RULES:
1. ANALYSIS: If provided with a report, identify every anomaly and rank them by importance.
2. STRUCTURE: Use Markdown to format your response (bold for key terms, bullet points for readability).
3. TONE: Be empathetic but factual. Explain complex terms if necessary.
4. SYNTHESIS: Do not be overly verbose, but be comprehensive on critical points.

MANDATORY OUTPUT FORMAT (JSON ONLY):
Reply ONLY with this JSON object, with no surrounding text:
{
  "reply": "Your response text here (formatted in markdown).",
  "focus": "liver|lung|kidney|brain|heart|null"
}

3D FOCUS LOGIC:
- If the user asks a specific question about an organ or if the report signals a MAJOR anomaly on a specific organ, put its name in "focus".
- Otherwise, set "focus": null.
`;

const organKeywords = ['liver', 'lung', 'kidney', 'brain', 'heart'];

const extractOrgan = (text) => {
  const lower = (text || '').toLowerCase();
  return organKeywords.find((k) => lower.includes(k)) || null;
};

/**
 * /chat: calls GPT-4o if API KEY available, else local mock.
 */
app.post('/chat', async (req, res) => {
  const { message } = req.body || {};

  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'Message required' });
  }

  // extract potential focus from user message (fallback/hint)
  const detectedOrgan = extractOrgan(message);

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

      try {
        // Try parsing JSON
        const parsed = JSON.parse(rawContent);
        return res.json({
          reply: parsed.reply,
          focus: parsed.focus || null,
        });
      } catch (e) {
        // Fallback if JSON is broken
        // eslint-disable-next-line no-console
        console.error('JSON Parse Error:', e);
        return res.json({
          reply: rawContent, // raw text
          focus: detectedOrgan, // fallback to regex detection
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

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${PORT}`);
});
