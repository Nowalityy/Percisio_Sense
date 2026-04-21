import { z } from 'zod';

/** Must stay aligned with express.json body limits and MCP paths */
export const MAX_MESSAGE_LENGTH = 10_000;
export const MAX_REPORT_TEXT_LENGTH = 20_000;

export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { message: 'Message must not be empty' })
    .max(MAX_MESSAGE_LENGTH, { message: `Message must not exceed ${MAX_MESSAGE_LENGTH} characters` }),
  /** Omitted, null, or string (e.g. embedded report from client) */
  reportText: z
    .string()
    .max(MAX_REPORT_TEXT_LENGTH, { message: `reportText must not exceed ${MAX_REPORT_TEXT_LENGTH} characters` })
    .nullish(),
});
