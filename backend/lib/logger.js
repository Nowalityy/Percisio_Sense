/**
 * Minimal dependency-free structured logger (JSON lines on stdout/stderr).
 *
 * Enterprise observability without pulling a heavy logging stack: every line
 * is a single JSON object with a timestamp, level, message, and arbitrary
 * structured fields. `child()` binds recurring fields (e.g. a requestId) so
 * all logs for one request can be correlated. Swappable for pino later
 * without changing call sites.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const CONFIGURED = (process.env.LOG_LEVEL || 'info').toLowerCase();
const THRESHOLD = LEVELS[CONFIGURED] ?? LEVELS.info;

function emit(level, baseFields, message, fields, stderrOnly) {
  if (LEVELS[level] < THRESHOLD) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...baseFields,
    ...(fields && typeof fields === 'object' ? fields : {}),
  };
  const serialized = JSON.stringify(line) + '\n';
  // stderr for warn/error so scrapers can split severity; stdout otherwise.
  // `stderrOnly` forces stderr (used by the MCP server, whose stdout is the
  // JSON-RPC channel and must not carry log lines).
  if (stderrOnly || level === 'error' || level === 'warn') process.stderr.write(serialized);
  else process.stdout.write(serialized);
}

function make(baseFields = {}, options = {}) {
  const stderrOnly = Boolean(options.stderrOnly);
  return {
    debug: (message, fields) => emit('debug', baseFields, message, fields, stderrOnly),
    info: (message, fields) => emit('info', baseFields, message, fields, stderrOnly),
    warn: (message, fields) => emit('warn', baseFields, message, fields, stderrOnly),
    error: (message, fields) => emit('error', baseFields, message, fields, stderrOnly),
    /** Return a logger that always includes `extra` fields. */
    child: (extra) => make({ ...baseFields, ...extra }, options),
  };
}

export const logger = make();

/** Logger that writes every level to stderr (for stdout-protocol processes). */
export function createStderrLogger(baseFields = {}) {
  return make(baseFields, { stderrOnly: true });
}

/** Short, URL-safe correlation id for one request. */
export function newRequestId() {
  return Math.random().toString(36).slice(2, 10);
}
