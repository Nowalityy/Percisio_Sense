/**
 * MCP server (stdio). Exposes extract_findings, highlight_evidence, risk_flags.
 * Log only to stderr to avoid corrupting JSON-RPC on stdout.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { REPORT_ORGAN_PATTERNS } from '../shared/reportOrganPatterns.js';

const log = (...args) => console.error('[mcp]', ...args);

const MAX_INPUT_LENGTH = 100_000;

function assertInputLength(value, label) {
  if (value != null && typeof value === 'string' && value.length > MAX_INPUT_LENGTH) {
    throw new Error(`${label || 'Input'} exceeds maximum length (${MAX_INPUT_LENGTH} characters).`);
  }
}

const NEGATION_MARKERS = /\b(pas de|absence de|aucun|aucune|sans|absence|non|negatif|négatif|no|without|absence of|negative for|negative|not seen|not visualized)\b/gi;
const RECOMMENDATION_MARKERS = /\b(recommandé|recommande|suivi|surveillance|contrôle|recommend|follow-up|suggest|surveillance|suggéré|preconise|préconisé)\b/gi;

/**
 * Detects medical entities using a longest-match strategy.
 * Prioritizes multi-word expressions over single keywords.
 */
function detectMedicalEntity(sentence) {
    ANOMALY_KEYWORDS_REGEX.lastIndex = 0;
    const matches = [];
    let match;
    while ((match = ANOMALY_KEYWORDS_REGEX.exec(sentence)) !== null) {
        matches.push(match[0]);
    }
    if (matches.length === 0) return null;
    // Longest match first to satisfy "nodule pulmonaire" > "nodule"
    return matches.sort((a, b) => b.length - a.length)[0];
}

/**
 * Detects if a term is negated in a sentence (4-word window).
 */
function detectNegation(term, sentence) {
  const lowerSentence = sentence.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const termIndex = lowerSentence.indexOf(lowerTerm);
  if (termIndex === -1) return false;

  const words = lowerSentence.slice(0, termIndex).trim().split(/\s+/);
  const lastFour = words.slice(-4).join(' ');
  NEGATION_MARKERS.lastIndex = 0;
  return NEGATION_MARKERS.test(lastFour);
}

/**
 * Classifies a sentence intent: finding, recommendation, negated, other.
 */
function classifySentence(sentence) {
  const lower = sentence.toLowerCase();
  
  // 1. RECOMMENDATION Check
  RECOMMENDATION_MARKERS.lastIndex = 0;
  if (RECOMMENDATION_MARKERS.test(lower)) return 'recommendation';

  // 2. NEGATION Check for entities
  const entity = detectMedicalEntity(sentence);
  if (entity && detectNegation(entity, sentence)) return 'negated';

  if (entity) return 'finding';
  return 'other';
}

/**
 * Deduplicates findings by grouping by medical entity and keeping the longest description.
 */
function deduplicateFindings(findings) {
  if (!Array.isArray(findings)) return [];
  const map = new Map();

  for (const sentence of findings) {
    const entity = detectMedicalEntity(sentence);
    if (!entity) continue;
    const core = entity.toLowerCase();
    
    if (!map.has(core) || sentence.length > map.get(core).length) {
      map.set(core, sentence);
    }
  }
  return Array.from(map.values());
}

const ANOMALY_KEYWORDS_REGEX =
  /\b(nodule pulmonaire|kyste hépatique|adénopathie médiastinale|fracture osseuse|embolie pulmonaire|épanchement pleural|nodule solide|abcès hépatique|lésion suspecte|masse tumorale|verre dépoli|opacité nodulaire|nodule|mass|lesion|lésion|effusion|atelectasis|consolidation|enlarged|dilation|dilatation|fracture|embolism|pneumothorax|thickening|épaississement|opacity|infiltrate|infiltration|edema|oedème|stenosis|sténose|abnormal|anomalie|pathology|pathologie|enlargement|collection|abcès|abces|stercolithe|nodulaire|hémorragie|opacité|atelectasie|abcés|kyste|embolie|adénopathie)\b/gi;

function extractFindingsImpl(reportText) {
  if (!reportText || typeof reportText !== 'string') return { byOrgan: {}, riskFlags: [], ignoredNegated: [], recommendations: [] };
  const byOrgan = Object.create(null);
  const ignoredNegated = new Set();
  const recommendations = [];

  // Step 1: Segmentation
  const sentences = reportText.split(/[.!?;\n]/).map((s) => s.trim()).filter(Boolean);

  for (const sentence of sentences) {
    // Step 2: Intent Classification
    const type = classifySentence(sentence);

    if (type === 'recommendation') {
      recommendations.push(sentence);
      continue;
    }

    if (type === 'negated') {
      // Step 4: Negation Filtering
      const entity = detectMedicalEntity(sentence);
      if (entity) ignoredNegated.add(entity.toLowerCase());
      continue;
    }

    if (type !== 'finding') continue;

    // Step 5: Organ Classification
    let matchedOrgan = 'other';
    for (const [organName, re] of REPORT_ORGAN_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(sentence)) {
        matchedOrgan = organName;
        break;
      }
    }

    if (!byOrgan[matchedOrgan]) byOrgan[matchedOrgan] = [];
    byOrgan[matchedOrgan].push(sentence);
  }

  // Step 6: Deduplication
  for (const organ in byOrgan) {
    byOrgan[organ] = deduplicateFindings(byOrgan[organ]);
  }

  // Step 7: Risk Scoring
  const risks = riskFlagsImpl(JSON.stringify(byOrgan));

  return { 
      byOrgan, 
      riskFlags: risks.flags,
      ignoredNegated: Array.from(ignoredNegated), 
      recommendations 
  };
}

function highlightEvidenceImpl(reportText, needle) {
  if (!reportText || typeof reportText !== 'string') return { quote: '', start: -1, end: -1 };
  if (!needle || typeof needle !== 'string') return { quote: '', start: -1, end: -1 };
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
      const lineStart = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      return { quote: line, start: lineStart, end: lineStart + line.length };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    if (words.some((w) => lineLower.includes(w))) {
      const line = lines[i];
      const lineStart = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      return { quote: line, start: lineStart, end: lineStart + line.length };
    }
  }
  return { quote: '', start: -1, end: -1 };
}

const RISKS = {
    critical: /\b(pneumothorax|embolie pulmonaire|hémorragie|fracture)\b/gi,
    clinical: /\b(nodule pulmonaire|adénopathie|masse|lésion suspecte|nodule solide)\b/gi,
    low: /\b(kyste|kyste bénin|kyste benin|abcès|abcés)\b/gi
};

function riskFlagsImpl(textInput) {
  const flags = [];
  const text = typeof textInput === 'string' ? textInput : JSON.stringify(textInput);
  const seen = new Set();

  const processRisks = (regex, level, label) => {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const word = m[0].toLowerCase();
      if (!seen.has(word)) {
          seen.add(word);
          flags.push({ level, text: `${label}: ${word}` });
      }
    }
  };

  processRisks(RISKS.critical, 'high', 'Critical risk');
  processRisks(RISKS.clinical, 'medium', 'Clinical finding');
  processRisks(RISKS.low, 'low', 'Minor finding');

  return { flags };
}

const HIGH_RISK_KEYWORDS = /\b(pneumothorax|embolie|hémorragie|fracture)\b/gi;
const CLINICAL_RISK_KEYWORDS =
  /\b(nodule|adénopathie|masse|lésion|lesion|opacité|opacite|verre dépoli|atelectasie|épanchement|epanchement)\b/gi;

function getClinicalPriorityImpl(byOrgan) {
  const findings = JSON.stringify(byOrgan).toLowerCase();
  HIGH_RISK_KEYWORDS.lastIndex = 0;
  if (HIGH_RISK_KEYWORDS.test(findings)) {
    return { priority: 'P0', status: 'Emergency', description: 'Life-threatening findings detected.' };
  }
  CLINICAL_RISK_KEYWORDS.lastIndex = 0;
  if (CLINICAL_RISK_KEYWORDS.test(findings)) {
    return { priority: 'P1', status: 'Urgent', description: 'Significant clinical findings require prompt review.' };
  }
  return { priority: 'P2', status: 'Routine', description: 'Routine clinical findings.' };
}

const server = new McpServer({
  name: 'chatbot-mcp',
  version: '1.0.0',
});

server.registerTool(
  'extract_findings',
  { description: 'Extract findings from report text grouped by organ.', inputSchema: z.object({ reportText: z.string() }) },
  async ({ reportText }) => {
    log('extract_findings called');
    assertInputLength(reportText, 'reportText');
    const result = extractFindingsImpl(reportText);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  'highlight_evidence',
  { description: 'Find evidence span or closest line for a needle in report text.', inputSchema: z.object({ reportText: z.string(), needle: z.string() }) },
  async ({ reportText, needle }) => {
    log('highlight_evidence called');
    assertInputLength(reportText, 'reportText');
    const result = highlightEvidenceImpl(reportText, needle);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  'risk_flags',
  { description: 'Return risk flags from byOrgan or reportText. Input: reportText (preferred) or byOrgan findings.', inputSchema: z.object({ reportText: z.string().optional(), byOrgan: z.record(z.string(), z.array(z.string())).optional(), findings: z.record(z.any()).optional() }) },
  async (args) => {
    log('risk_flags called');
    const input = args?.reportText ?? args?.byOrgan ?? args?.findings ?? {};
    const result = riskFlagsImpl(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  'get_clinical_priority',
  { description: 'Get clinical priority (P0-P2) from findings.', inputSchema: z.object({ byOrgan: z.record(z.string(), z.array(z.string())) }) },
  async ({ byOrgan }) => {
    log('get_clinical_priority called');
    const result = getClinicalPriorityImpl(byOrgan);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
log('MCP server connected (stdio)');
