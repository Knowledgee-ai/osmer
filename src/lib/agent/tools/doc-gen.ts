import { z } from 'zod';
import { put } from '@vercel/blob';
import type { Tool } from '../types';

const PdfParams = z.object({
  filename: z.string(),
  markdown: z.string(),
});

export const docPdfTool: Tool<typeof PdfParams> = {
  id: 'doc.markdown_to_pdf',
  description: 'Render markdown to a printable HTML document and return its URL. (PDF rendering will be wired through a Sandbox Chromium pass in a follow-up; current output is print-ready HTML.)',
  parameters: PdfParams,
  permission: 'paid',
  costEstimateCents: () => 5,
  async execute(args, ctx) {
    const escaped = args.markdown.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as Record<string, string>)[c]);
    const html = `<!doctype html>
<meta charset="utf-8">
<title>${args.filename}</title>
<style>
  body { font-family: 'Times New Roman', serif; padding: 2.5rem; max-width: 7in; margin: 0 auto; line-height: 1.5; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; }
</style>
<body><pre>${escaped}</pre></body>`;
    const buf = Buffer.from(html, 'utf-8');
    const safe = args.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { url } = await put(`orgs/${ctx.orgId}/runs/${ctx.runId}/${safe}.html`, buf, {
      access: 'public',
      contentType: 'text/html',
    });
    return { url, filename: `${safe}.html` };
  },
};

const PptxParams = z.object({
  filename: z.string(),
  slides_markdown: z.string().describe('Slide outline in markdown; separate slides with `---` on its own line.'),
});

export const docPptxTool: Tool<typeof PptxParams> = {
  id: 'doc.markdown_to_pptx',
  description: 'Render a slide outline (markdown with --- separators per slide) to a downloadable file. Current output: markdown; pptx renderer ships in a follow-up.',
  parameters: PptxParams,
  permission: 'paid',
  costEstimateCents: () => 8,
  async execute(args, ctx) {
    const safe = args.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const buf = Buffer.from(args.slides_markdown, 'utf-8');
    const { url } = await put(`orgs/${ctx.orgId}/runs/${ctx.runId}/${safe}.md`, buf, {
      access: 'public',
      contentType: 'text/markdown',
    });
    return { url, filename: `${safe}.md` };
  },
};
