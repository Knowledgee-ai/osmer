import { z } from 'zod';
import type { Tool } from '../types';

const ImageGenerateParams = z.object({
  prompt: z.string(),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).default('1024x1024'),
});

export const imageGenerateTool: Tool<typeof ImageGenerateParams> = {
  id: 'image.generate',
  description: 'Generate an image from a text prompt. Returns a URL the user can view or download.',
  parameters: ImageGenerateParams,
  permission: 'paid',
  costEstimateCents: () => 4,
  async execute(args) {
    if (!process.env.OPENAI_API_KEY) {
      return { error: 'image.generate disabled — OPENAI_API_KEY not configured.' };
    }
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'gpt-image-1', prompt: args.prompt, size: args.size, n: 1 }),
    });
    if (!r.ok) throw new Error(`image gen failed: ${r.status}`);
    const j = (await r.json()) as { data: Array<{ url: string }> };
    return { url: j.data[0]?.url };
  },
};
