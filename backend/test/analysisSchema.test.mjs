import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAnalysis,
  analysisToBundle,
  offlineAnalysisFallback,
  analysisJsonSchema,
  FINDING_ORGAN_KEYS,
  SEVERITY_LEVELS,
} from '../lib/analysisSchema.js';

const validAnalysis = {
  impression: 'Findings suggest a primary pancreatic tumor with hepatic metastases.',
  findings: [
    { organ: 'liver', text: 'Multiple hypodense lesions, largest 42 mm.', severity: 'high' },
    { organ: 'pancreas', text: 'Focal head thickening, 28 mm.', severity: 'high' },
    { organ: 'other', text: 'Coeliac lymphadenopathy, 15 mm.', severity: 'medium' },
  ],
  risks: [
    { severity: 'high', text: 'Probable hepatic metastatic disease.' },
    { severity: 'medium', text: 'Regional lymphadenopathy.' },
  ],
  recommendations: ['Hepatic MRI.', 'PET-CT for staging.'],
  priority: { level: 'P1', status: 'Urgent', rationale: 'Suspected malignancy with metastases.' },
};

describe('validateAnalysis', () => {
  it('accepts a well-formed analysis', () => {
    const out = validateAnalysis(validAnalysis);
    assert.equal(out.findings.length, 3);
    assert.equal(out.priority.level, 'P1');
  });

  it('rejects an invalid severity', () => {
    const bad = { ...validAnalysis, findings: [{ organ: 'liver', text: 'x', severity: 'urgent' }] };
    assert.throws(() => validateAnalysis(bad));
  });

  it('rejects a missing required field', () => {
    const { impression, ...rest } = validAnalysis;
    void impression;
    assert.throws(() => validateAnalysis(rest));
  });
});

describe('analysisToBundle', () => {
  it('groups findings by organ and carries the rich fields', () => {
    const bundle = analysisToBundle(validAnalysis);
    assert.deepEqual(Object.keys(bundle.byOrgan).sort(), ['liver', 'other', 'pancreas']);
    assert.equal(bundle.byOrgan.liver[0], 'Multiple hypodense lesions, largest 42 mm.');
    assert.equal(bundle.impression, validAnalysis.impression);
    assert.deepEqual(bundle.recommendations, validAnalysis.recommendations);
  });

  it('maps risks to {level,text} flags', () => {
    const bundle = analysisToBundle(validAnalysis);
    assert.equal(bundle.riskFlags.length, 2);
    assert.deepEqual(bundle.riskFlags[0], { level: 'high', text: 'Probable hepatic metastatic disease.' });
  });

  it('maps priority to the legacy clinicalPriority shape', () => {
    const bundle = analysisToBundle(validAnalysis);
    assert.deepEqual(bundle.clinicalPriority, {
      priority: 'P1',
      status: 'Urgent',
      description: 'Suspected malignancy with metastases.',
    });
  });

  it('defaults a missing organ to "other"', () => {
    const bundle = analysisToBundle({
      ...validAnalysis,
      findings: [{ organ: '', text: 'Unspecified.', severity: 'low' }],
    });
    assert.ok(bundle.byOrgan.other.includes('Unspecified.'));
  });
});

describe('offlineAnalysisFallback', () => {
  it('produces a schema-valid bundle without medical interpretation', () => {
    const fb = offlineAnalysisFallback('Liver: lesions.\nPancreas: thickening.\nLong enough line here.');
    // It must validate against the same schema the model output uses.
    assert.doesNotThrow(() => validateAnalysis(fb));
    assert.equal(fb.priority.level, 'P2');
    assert.equal(fb.risks.length, 0);
    assert.ok(fb.findings.every((f) => f.severity === 'none' && f.organ === 'other'));
  });

  it('handles empty input', () => {
    const fb = offlineAnalysisFallback('');
    assert.doesNotThrow(() => validateAnalysis(fb));
    assert.equal(fb.findings.length, 0);
  });
});

describe('analysisJsonSchema (OpenAI structured outputs)', () => {
  it('is strict with all properties required and additionalProperties false', () => {
    const s = analysisJsonSchema.schema;
    assert.equal(analysisJsonSchema.strict, true);
    assert.equal(s.additionalProperties, false);
    assert.deepEqual(
      s.required.sort(),
      ['findings', 'impression', 'priority', 'recommendations', 'risks']
    );
  });

  it('constrains finding organ to the canonical key set (incl. "other")', () => {
    const enumKeys = analysisJsonSchema.schema.properties.findings.items.properties.organ.enum;
    assert.deepEqual(enumKeys, FINDING_ORGAN_KEYS);
    assert.ok(enumKeys.includes('other'));
    assert.ok(enumKeys.includes('liver'));
  });

  it('finding severity enum matches SEVERITY_LEVELS', () => {
    const sev = analysisJsonSchema.schema.properties.findings.items.properties.severity.enum;
    assert.deepEqual(sev, SEVERITY_LEVELS);
  });
});
