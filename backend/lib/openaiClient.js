/**
 * Shared OpenAI access for the backend and the MCP server.
 *
 * One place to configure the model, token caps, timeouts, and retry/backoff
 * so every caller (chat + structured analysis) behaves consistently —
 * enterprise reliability without scattering API logic across files.
 */

import OpenAI from 'openai';
import {
  analysisJsonSchema,
  validateAnalysis,
  analysisToBundle,
  offlineAnalysisFallback,
} from './analysisSchema.js';
import { withRetry } from './retry.js';
import { logger } from './logger.js';

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 45_000;
const MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES) || 2;

/** Token caps bound cost and latency. Analysis needs more room than chat. */
const ANALYSIS_MAX_TOKENS = Number(process.env.OPENAI_ANALYSIS_MAX_TOKENS) || 1500;
const CHAT_MAX_TOKENS = Number(process.env.OPENAI_CHAT_MAX_TOKENS) || 900;

/** Lower temperature for clinical work — favour consistency over creativity. */
const ANALYSIS_TEMPERATURE = 0.1;
const CHAT_TEMPERATURE = 0.3;

let client = null;

export function getOpenAI() {
  if (client) return client;
  if (!process.env.OPENAI_API_KEY) return null;
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0, // retry/backoff is handled by withRetry (single policy)
  });
  return client;
}

export function isModelConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

const retryOpts = (label, log) => ({
  maxRetries: MAX_RETRIES,
  onRetry: ({ attempt, delayMs, error }) =>
    (log ?? logger).warn('openai retry', {
      op: label,
      attempt,
      delayMs,
      cause: error?.status ?? error?.code ?? error?.message,
    }),
});

const ANALYSIS_SYSTEM_PROMPT = `You are a senior radiologist producing a STRUCTURED analysis of an imaging report for a clinical platform.

Rules:
- Output MUST conform to the provided JSON schema. No prose outside it.
- Work strictly from the report. Never invent findings, measurements, or diagnoses that are not supported by the text. If the report does not state something, do not include it.
- Translate everything into clear, professional clinical ENGLISH regardless of the report's source language.
- "findings": only POSITIVE/abnormal observations actually present in the report, one clean sentence each, tagged with the closest anatomical key (or "other"). Do not list normal/negated items ("no nodule") as findings.
- "risks": clinically actionable concerns that warrant attention; assign severity honestly (high = potentially serious/urgent).
- "impression": the radiologist's concise conclusion, grounded in the findings.
- "recommendations": concrete next steps if the report implies any; otherwise an empty list.
- "priority": P0 (emergency / life-threatening), P1 (urgent / significant), or P2 (routine), with a one-line rationale.`;

/**
 * Produce the canonical structured analysis for a report.
 * Returns the legacy-compatible bundle ({ byOrgan, riskFlags, clinicalPriority,
 * impression, recommendations, findings }). Falls back to a non-clinical
 * offline bundle if the model is not configured.
 *
 * @param {string} reportText
 * @param {import('./logger.js').logger} [log]
 * @returns {Promise<{ bundle: object, source: 'model' | 'offline', usage?: object }>}
 */
export async function analyzeReport(reportText, log = logger) {
  const openai = getOpenAI();
  if (!openai) {
    return { bundle: analysisToBundle(offlineAnalysisFallback(reportText)), source: 'offline' };
  }

  const startedAt = Date.now();
  const completion = await withRetry(
    () =>
      openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: ANALYSIS_TEMPERATURE,
        max_tokens: ANALYSIS_MAX_TOKENS,
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: `Imaging report:\n\n${reportText}` },
        ],
        response_format: { type: 'json_schema', json_schema: analysisJsonSchema },
      }),
    retryOpts('analyzeReport', log)
  );

  const content = completion.choices?.[0]?.message?.content ?? '';
  const analysis = validateAnalysis(JSON.parse(content));
  const usage = completion.usage ?? null;
  log.info('analysis complete', {
    op: 'analyzeReport',
    durationMs: Date.now() - startedAt,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
  });
  return { bundle: analysisToBundle(analysis), source: 'model', usage };
}

/**
 * Stream a conversational clinical reply token by token.
 *
 * @param {{role:string,content:string}[]} messages - full chat messages incl. system
 * @param {(delta: string) => void} onDelta - called with each text chunk
 * @param {import('./logger.js').logger} [log]
 * @returns {Promise<{ text: string, usage: object | null }>}
 */
export async function streamChatReply(messages, onDelta, log = logger) {
  const openai = getOpenAI();
  if (!openai) throw new Error('OpenAI not configured');

  // The create() call is guarded (setup/connection failures throw before any
  // delta is emitted); the stream itself is consumed once.
  const stream = await withRetry(
    () =>
      openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: CHAT_TEMPERATURE,
        max_tokens: CHAT_MAX_TOKENS,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
    retryOpts('streamChatReply', log)
  );

  let text = '';
  let usage = null;
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content ?? '';
    if (delta) {
      text += delta;
      onDelta(delta);
    }
    if (chunk.usage) usage = chunk.usage; // final chunk carries usage
  }
  return { text, usage };
}

/** Non-streaming chat reply (fallback path). */
export async function chatReply(messages, log = logger) {
  const openai = getOpenAI();
  if (!openai) throw new Error('OpenAI not configured');
  const completion = await withRetry(
    () =>
      openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: CHAT_TEMPERATURE,
        max_tokens: CHAT_MAX_TOKENS,
        messages,
      }),
    retryOpts('chatReply', log)
  );
  return completion.choices?.[0]?.message?.content?.trim() ?? '';
}
