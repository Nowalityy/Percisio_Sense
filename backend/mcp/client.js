/**
 * MCP client using the official SDK. Spawns backend/mcp/server.js via StdioClientTransport.
 * Lazy init, 10s tool timeout, auto-clear on process exit so next init() respawns.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOL_CALL_TIMEOUT_MS = 10_000;
const MCP_SERVER_PATH = join(__dirname, 'server.js');
const MCP_CWD = join(__dirname, '..');

let client = null;
let transport = null;
let initPromise = null;
let connected = false;

function clearConnection() {
  connected = false;
  client = null;
  transport = null;
  initPromise = null;
}

async function ensureConnection() {
  if (client && transport && connected) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const t = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_SERVER_PATH],
      cwd: MCP_CWD,
      stderr: 'inherit',
      env: { ...process.env },
    });

    t.onclose = () => {
      clearConnection();
    };

    const c = new Client(
      { name: 'chatbot-backend', version: '1.0.0' },
      { capabilities: {} }
    );

    try {
      await c.connect(t);
    } catch (err) {
      clearConnection();
      throw err;
    }

    transport = t;
    client = c;
    connected = true;
    return undefined;
  })();

  await initPromise;
}

export async function init() {
  await ensureConnection();
}

export async function callTool(name, args) {
  await init();

  const result = await client.callTool(
    { name, arguments: args ?? {} },
    undefined,
    { timeout: TOOL_CALL_TIMEOUT_MS }
  );

  if (result?.isError) {
    const parts = Array.isArray(result.content)
      ? result.content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).filter(Boolean)
      : [];
    const msg = parts.length ? parts.join('') : result.message || 'Tool call failed';
    throw new Error(msg);
  }

  const content = result?.content;
  if (!Array.isArray(content) || content.length === 0) {
    return result ?? { raw: null };
  }

  const text = content
    .map((block) => (block && typeof block.text === 'string' ? block.text : ''))
    .join('');

  if (text === '') {
    return result ?? { raw: null };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function isAvailable() {
  return connected && !!client && !!transport;
}
