import { z } from 'zod';
import type { Tool } from '../types';

const WebSearchParams = z.object({
  query: z.string(),
  topK: z.number().int().min(1).max(10).default(5),
});

export const webSearchTool: Tool<typeof WebSearchParams> = {
  id: 'web.search',
  description: 'Search the public web for relevant pages. Returns titles, URLs, and short snippets.',
  parameters: WebSearchParams,
  permission: 'baseline',
  costEstimateCents: () => 2,
  async execute(args) {
    if (!process.env.TAVILY_API_KEY) {
      return { results: [], note: 'web.search disabled — TAVILY_API_KEY not configured.' };
    }
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: args.query,
        max_results: args.topK,
        search_depth: 'basic',
      }),
    });
    if (!r.ok) throw new Error(`tavily failed: ${r.status}`);
    const j = (await r.json()) as { results?: Array<{ title: string; url: string; content: string }> };
    return {
      results: (j.results ?? []).map((x) => ({ title: x.title, url: x.url, snippet: x.content })),
    };
  },
};
