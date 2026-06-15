/**
 * Canonical structured radiology analysis — the single shape the whole app
 * speaks. Produced by the LLM (structured outputs) and validated with zod.
 *
 * Everything here is language-agnostic: the model reads a report in ANY
 * language and returns clean clinical English. No hardcoded medical
 * vocabulary — the only fixed list is the canonical organ/region keys, which
 * map to real 3D meshes (a navigation-safety boundary, not medical logic).
 */

import { z } from 'zod';
import { FOCUS_KEYS } from './focusSanitize.js';

export const SEVERITY_LEVELS = ['none', 'low', 'medium', 'high'];
export const RISK_LEVELS = ['low', 'medium', 'high'];
export const PRIORITY_LEVELS = ['P0', 'P1', 'P2'];

/**
 * Organ keys the model may tag a finding with. These are the focusable 3D
 * keys plus `other` for anything without a dedicated mesh. Kept as a closed
 * set so findings can drive click-to-locate in the viewer.
 */
export const FINDING_ORGAN_KEYS = Array.from(new Set([...FOCUS_KEYS, 'other']));

export const analysisZodSchema = z.object({
  impression: z.string(),
  findings: z
    .array(
      z.object({
        organ: z.string(),
        text: z.string(),
        severity: z.enum(SEVERITY_LEVELS),
      })
    )
    .max(24),
  risks: z
    .array(
      z.object({
        severity: z.enum(RISK_LEVELS),
        text: z.string(),
      })
    )
    .max(16),
  recommendations: z.array(z.string()).max(12),
  priority: z.object({
    level: z.enum(PRIORITY_LEVELS),
    status: z.string(),
    rationale: z.string(),
  }),
});

/**
 * JSON Schema for OpenAI structured outputs (strict mode). Strict requires
 * every property listed in `required` and `additionalProperties: false`.
 */
export const analysisJsonSchema = {
  name: 'radiology_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      impression: {
        type: 'string',
        description:
          'One to three sentence clinical conclusion in professional English, grounded strictly in the report.',
      },
      findings: {
        type: 'array',
        description: 'Objective positive findings from the report, one clean statement each.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            organ: {
              type: 'string',
              description:
                'Anatomical region for this finding. Use one of the canonical keys when applicable, else "other".',
              enum: FINDING_ORGAN_KEYS,
            },
            text: {
              type: 'string',
              description: 'The finding as one clear English sentence (no list markers).',
            },
            severity: { type: 'string', enum: SEVERITY_LEVELS },
          },
          required: ['organ', 'text', 'severity'],
        },
      },
      risks: {
        type: 'array',
        description: 'Clinically actionable risks or flagged findings worth a clinician’s attention.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            severity: { type: 'string', enum: RISK_LEVELS },
            text: { type: 'string' },
          },
          required: ['severity', 'text'],
        },
      },
      recommendations: {
        type: 'array',
        description: 'Suggested follow-up steps in English.',
        items: { type: 'string' },
      },
      priority: {
        type: 'object',
        additionalProperties: false,
        properties: {
          level: { type: 'string', enum: PRIORITY_LEVELS },
          status: { type: 'string', description: 'Short label, e.g. Emergency / Urgent / Routine.' },
          rationale: { type: 'string', description: 'One short sentence justifying the level.' },
        },
        required: ['level', 'status', 'rationale'],
      },
    },
    required: ['impression', 'findings', 'risks', 'recommendations', 'priority'],
  },
};

/** Coerce arbitrary parsed JSON into the validated analysis (or throw). */
export function validateAnalysis(raw) {
  return analysisZodSchema.parse(raw);
}

/**
 * Non-clinical fallback used ONLY when no OpenAI key is configured (or the
 * model is unreachable). It does NOT interpret the report — it surfaces the
 * raw lines as plain findings so the UI is not empty in dev, and makes clear
 * that real analysis needs the model. Deliberately free of medical heuristics.
 */
export function offlineAnalysisFallback(reportText) {
  const lines = String(reportText || '')
    .split(/\r?\n|(?<=[.;])\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8)
    .slice(0, 8);
  return {
    impression:
      'Automated analysis is unavailable (no AI model configured). The report content is shown below without clinical interpretation.',
    findings: lines.map((text) => ({ organ: 'other', text, severity: 'none' })),
    risks: [],
    recommendations: ['Configure the AI model to enable structured clinical analysis.'],
    priority: { level: 'P2', status: 'Unscored', rationale: 'No model available to assess priority.' },
  };
}

/**
 * Map the canonical analysis to the legacy bundle the rest of the backend
 * already consumes ({ byOrgan, riskFlags, clinicalPriority }) while also
 * carrying the richer fields forward (impression, recommendations, findings).
 */
export function analysisToBundle(analysis) {
  const byOrgan = Object.create(null);
  for (const f of analysis.findings ?? []) {
    const key = typeof f.organ === 'string' && f.organ.trim() ? f.organ.trim() : 'other';
    if (!byOrgan[key]) byOrgan[key] = [];
    if (f.text && typeof f.text === 'string') byOrgan[key].push(f.text.trim());
  }
  const riskFlags = (analysis.risks ?? []).map((r) => ({
    level: r.severity,
    text: r.text,
  }));
  const priority = analysis.priority ?? null;
  const clinicalPriority = priority
    ? { priority: priority.level, status: priority.status, description: priority.rationale }
    : null;

  return {
    byOrgan,
    riskFlags,
    clinicalPriority,
    impression: analysis.impression ?? '',
    recommendations: analysis.recommendations ?? [],
    findings: analysis.findings ?? [],
  };
}
