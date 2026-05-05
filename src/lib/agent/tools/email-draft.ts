import { z } from 'zod';
import type { Tool } from '../types';

const EmailDraftParams = z.object({
  to: z.string(),
  subject: z.string(),
  body: z.string(),
});

/**
 * Compose an email draft. Returns the draft as data; never sends.
 * Sending requires user action via the chat UI's "Send" button which
 * goes through a future email integration (M4.1 / M5).
 */
export const emailDraftTool: Tool<typeof EmailDraftParams> = {
  id: 'email.draft',
  description: 'Compose an email DRAFT. Returns to/subject/body as data so the user can review and send manually. NEVER sends.',
  parameters: EmailDraftParams,
  permission: 'baseline',
  costEstimateCents: () => 0,
  async execute(args) {
    return {
      draft: { to: args.to, subject: args.subject, body: args.body },
      note: 'Draft only — not sent. The user reviews and sends from their email client.',
    };
  },
};
