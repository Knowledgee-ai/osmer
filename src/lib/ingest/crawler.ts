import * as cheerio from 'cheerio';
import { ingestSource } from '@/lib/memory/ingest';
import { chunkText } from '@/lib/memory/chunker';

const MAX_PAGES = 50;
const POLITE_DELAY_MS = 500;
const FETCH_TIMEOUT_MS = 15_000;

export interface CrawlReport {
  pagesCrawled: number;
  sourceIds: string[];
  skipped: number;
}

/**
 * Sitemap-first crawler. Fetches /sitemap.xml when present; falls back
 * to the start URL alone. Polite (500ms between fetches), depth-1
 * (only the URLs from the sitemap), capped at MAX_PAGES.
 */
export async function crawlSite(
  orgId: string,
  ownerUserId: string,
  startUrl: string,
): Promise<CrawlReport> {
  const start = new URL(startUrl);
  const urls = (await fetchSitemap(start)) ?? [start.toString()];
  const seen = new Set<string>();
  const sourceIds: string[] = [];
  let pagesCrawled = 0;
  let skipped = 0;

  for (const u of urls) {
    if (pagesCrawled >= MAX_PAGES) break;
    if (seen.has(u)) { skipped++; continue; }
    seen.add(u);
    try {
      const r = await fetchWithTimeout(u);
      if (!r.ok) { skipped++; continue; }
      const html = await r.text();
      const $ = cheerio.load(html);
      $('script, style, nav, footer, header, noscript').remove();
      const title = $('title').first().text().trim() || u;
      const main = $('main').text() || $('article').text() || $('body').text();
      const cleaned = main.replace(/\s+/g, ' ').trim();
      if (cleaned.length < 100) { skipped++; continue; }

      const sourceId = await ingestSource({
        orgId,
        type: 'crawl',
        ownerUserId,
        title,
        chunks: chunkText(cleaned).map((c) => ({ ord: c.ord, content: c.content, meta: { url: u } })),
        meta: { url: u, crawledAt: new Date().toISOString() },
      });
      sourceIds.push(sourceId);
      pagesCrawled++;
      await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
    } catch {
      skipped++;
    }
  }

  return { pagesCrawled, sourceIds, skipped };
}

async function fetchSitemap(start: URL): Promise<string[] | null> {
  try {
    const r = await fetchWithTimeout(`${start.origin}/sitemap.xml`);
    if (!r.ok) return null;
    const xml = await r.text();
    const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    return matches.filter((u) => u.startsWith(start.origin)).slice(0, MAX_PAGES);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': 'OsmerCrawler/1.0 (+https://osmer.ai)' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}
