import { z } from 'zod';
import { put } from '@vercel/blob';
import type { Tool } from '../types';

const FileWriteParams = z.object({
  filename: z.string(),
  content: z.string(),
  contentType: z.string().default('text/plain'),
});

export const fileWriteTool: Tool<typeof FileWriteParams> = {
  id: 'file.write',
  description: 'Save content to a file in the run artifacts area. Returns a URL the user can download.',
  parameters: FileWriteParams,
  permission: 'paid',
  costEstimateCents: () => 1,
  async execute(args, ctx) {
    const safe = args.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { url } = await put(`orgs/${ctx.orgId}/runs/${ctx.runId}/${safe}`, Buffer.from(args.content, 'utf-8'), {
      access: 'public',
      contentType: args.contentType,
    });
    return { url, filename: safe };
  },
};
