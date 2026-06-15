/**
 * MCP server (stdio). Exposes the clinical analysis tools used by the backend.
 *
 * `extract_findings` is now LLM-backed (OpenAI structured outputs) — no
 * hardcoded medical vocabulary, works in any source language, returns clean
 * clinical English. `highlight_evidence` stays a deterministic text search
 * (locating a span in the source is not a medical judgement).
 *
 * Log only to stderr to avoid corrupting JSON-RPC on stdout.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzeReport } from '../lib/openaiClient.js';
import { createStderrLogger } from '../lib/logger.js';

// MCP communicates over stdout (JSON-RPC); this logger writes every level to
// stderr so structured logs never corrupt the protocol stream.
const mcpLog = createStderrLogger({ component: 'mcp' });

const MAX_INPUT_LENGTH = 100_000;

function assertInputLength(value, label) {
  if (value != null && typeof value === 'string' && value.length > MAX_INPUT_LENGTH) {
    throw new Error(`${label || 'Input'} exceeds maximum length (${MAX_INPUT_LENGTH} characters).`);
  }
}

/** Deterministic evidence locator: exact span, else closest line by word overlap. */
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

const server = new McpServer({
  name: 'chatbot-mcp',
  version: '2.0.0',
});

server.registerTool(
  'extract_findings',
  {
    description:
      'Analyze an imaging report (any language) and return a structured clinical analysis in English: byOrgan findings, risk flags, clinical priority, impression, and recommendations.',
    inputSchema: z.object({ reportText: z.string() }),
  },
  async ({ reportText }) => {
    mcpLog.info('extract_findings called');
    assertInputLength(reportText, 'reportText');
    const { bundle, source } = await analyzeReport(reportText, mcpLog);
    mcpLog.info('extract_findings done', { source });
    return { content: [{ type: 'text', text: JSON.stringify({ ...bundle, _source: source }) }] };
  }
);

server.registerTool(
  'highlight_evidence',
  {
    description: 'Find the evidence span (or closest line) for a needle phrase in the report text.',
    inputSchema: z.object({ reportText: z.string(), needle: z.string() }),
  },
  async ({ reportText, needle }) => {
    mcpLog.info('highlight_evidence called');
    assertInputLength(reportText, 'reportText');
    const result = highlightEvidenceImpl(reportText, needle);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
mcpLog.info('MCP server connected (stdio)');
