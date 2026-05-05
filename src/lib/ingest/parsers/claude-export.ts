import JSZip from 'jszip';
import type { Parser, ParserResult } from '../types';

export const claudeExportParser: Parser = {
  matches: (_mime, name) => name.toLowerCase().endsWith('.zip') &&
    (name.toLowerCase().includes('claude') || name.toLowerCase().includes('anthropic')),
  async parse(buffer, _filename) {
    const zip = await JSZip.loadAsync(buffer);
    const chunks: ParserResult['chunks'] = [];
    let ord = 0;
    const jsonFiles = Object.keys(zip.files).filter((n) => n.endsWith('.json'));
    for (const f of jsonFiles) {
      try {
        const text = await zip.files[f].async('text');
        const data = JSON.parse(text) as { name?: string; messages?: Array<{ sender: string; text: string }> };
        if (Array.isArray(data.messages)) {
          for (const m of data.messages) {
            chunks.push({
              ord: ord++,
              content: `[${m.sender}] ${m.text}`,
              meta: { conversation: data.name ?? f, role: m.sender },
            });
          }
        }
      } catch { /* skip malformed */ }
    }
    return { title: 'Claude export', chunks };
  },
};
