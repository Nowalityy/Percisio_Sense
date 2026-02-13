/**
 * MCP server (stdio). Exposes extract_findings, highlight_evidence, risk_flags.
 * Log only to stderr to avoid corrupting JSON-RPC on stdout.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const log = (...args) => console.error('[mcp]', ...args);

const MAX_INPUT_LENGTH = 100_000;

function assertInputLength(value, label) {
  if (value != null && typeof value === 'string' && value.length > MAX_INPUT_LENGTH) {
    throw new Error(`${label || 'Input'} exceeds maximum length (${MAX_INPUT_LENGTH} characters).`);
  }
}

const REPORT_ORGAN_PATTERNS = [
  ['pleura', /\b(pleura|pleural)\b/gi],
  ['lungs', /\b(lung|lungs|pulmonary)\b/gi],
  ['heart', /\b(heart|cardiac|atrium|ventricle|pericardium)\b/gi],
  ['liver', /\b(liver|hepatic)\b/gi],
  ['bones', /\b(bone|skeleton|spine|vertebra|clavicle|scapula|humerus|sternum|rib)\b/gi],
  ['vessels', /\b(aorta|artery|vein|vessel|vascular|IVC|SVC)\b/gi],
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

function extractFindingsImpl(reportText) {
  if (!reportText || typeof reportText !== 'string') return { byOrgan: {} };
  const byOrgan = Object.create(null);
  const lines = reportText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    ANOMALY_KEYWORDS.lastIndex = 0;
    if (!ANOMALY_KEYWORDS.test(line)) continue;
    let matched = false;
    for (const [organName, re] of REPORT_ORGAN_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line)) {
        if (!byOrgan[organName]) byOrgan[organName] = [];
        const trimmed = line.slice(0, 300);
        if (!byOrgan[organName].includes(trimmed)) byOrgan[organName].push(trimmed);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!byOrgan.other) byOrgan.other = [];
      const trimmed = line.slice(0, 300);
      if (!byOrgan.other.includes(trimmed)) byOrgan.other.push(trimmed);
    }
  }
  const keys = Object.keys(byOrgan);
  if (keys.length > 8) {
    const sorted = keys.sort((a, b) => byOrgan[b].length - byOrgan[a].length).slice(0, 8);
    const out = Object.create(null);
    for (const k of sorted) out[k] = byOrgan[k];
    return { byOrgan: out };
  }
  return { byOrgan };
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

const HIGH_RISK_KEYWORDS = /\b(pneumothorax|embolism|dissection|hemorrhage|fracture|rupture|infarction)\b/gi;

function riskFlagsImpl(byOrgan) {
  const flags = [];
  const text = typeof byOrgan === 'object' && byOrgan !== null
    ? JSON.stringify(byOrgan)
    : String(byOrgan ?? '');
  HIGH_RISK_KEYWORDS.lastIndex = 0;
  let m;
  const seen = new Set();
  while ((m = HIGH_RISK_KEYWORDS.exec(text)) !== null) {
    const word = m[0].toLowerCase();
    if (!seen.has(word)) {
      seen.add(word);
      flags.push({ level: 'high', text: `Keyword: ${word}` });
    }
  }
  return { flags };
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
  { description: 'Return risk flags from byOrgan/findings. Input: byOrgan or findings object.', inputSchema: z.object({ byOrgan: z.record(z.string(), z.array(z.string())).optional(), findings: z.record(z.any()).optional() }) },
  async (args) => {
    log('risk_flags called');
    const byOrgan = args?.byOrgan ?? args?.findings ?? {};
    const result = riskFlagsImpl(byOrgan);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
log('MCP server connected (stdio)');
