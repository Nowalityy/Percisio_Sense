import { z } from 'zod';

/** Must stay aligned with express.json body limits and MCP paths */
export const MAX_MESSAGE_LENGTH = 10_000;
/** First turn may embed the full report + template (see frontend CONTEXT_PROMPT_TEMPLATE). */
export const MAX_CHAT_USER_MESSAGE = 24_000;
export const MAX_REPORT_TEXT_LENGTH = 20_000;
export const MAX_HISTORY_MESSAGES = 24;
export const MAX_HISTORY_ENTRY_CHARS = 12_000;

const historyEntrySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .max(MAX_HISTORY_ENTRY_CHARS, {
      message: `history entry must not exceed ${MAX_HISTORY_ENTRY_CHARS} characters`,
    }),
});

export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { message: 'Message must not be empty' })
    .max(MAX_CHAT_USER_MESSAGE, {
      message: `Message must not exceed ${MAX_CHAT_USER_MESSAGE} characters`,
    }),
  /** Omitted, null, or string (e.g. embedded report from client) */
  reportText: z
    .string()
    .max(MAX_REPORT_TEXT_LENGTH, { message: `reportText must not exceed ${MAX_REPORT_TEXT_LENGTH} characters` })
    .nullish(),
  /** Prior user/assistant turns (latest user line is always `message`). */
  history: z.array(historyEntrySchema).max(MAX_HISTORY_MESSAGES).optional(),
});
