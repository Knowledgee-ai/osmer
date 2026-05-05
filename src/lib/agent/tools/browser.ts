import { z } from 'zod';
import * as cheerio from 'cheerio';
import type { Tool } from '../types';

const BrowserFetchParams = z.object({
  url: z.string().url(),
});

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_CHARS = 8000;

export const browserFetchTool: Tool<typeof BrowserFetchParams> = {
  id: 'web.fetch',
  description: 'Fetch a URL and return the cleaned text content. Use when web.search snippets are insufficient.',
  parameters: BrowserFetchParams,
  permission: 'paid',
  costEstimateCents: () => 1,
  async execute(args) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(args.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'OsmerAgent/1.0 (+https://osmer.ai)' },
      });
      if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
      const html = await r.text();
      const $ = cheerio.load(html);
      $('script, style, nav, footer, header, noscript').remove();
      const text = ($('main').text() || $('article').text() || $('body').text()).replace(/\s+/g, ' ').trim();
      return {
        url: args.url,
        content: text.slice(0, MAX_CONTENT_CHARS),
        truncated: text.length > MAX_CONTENT_CHARS,
      };
    } finally {
      clearTimeout(id);
    }
  },
};
