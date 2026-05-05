import { extractText } from 'unpdf';
import { chunkText } from '@/lib/memory/chunker';
import type { Parser } from '../types';

export const pdfParser: Parser = {
  matches: (mime, name) => mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf'),
  async parse(buffer, filename) {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    const full = Array.isArray(text) ? text.join('\n\n') : text;
    if (full.trim().length < 50) {
      // Vision-OCR fallback is M2.1; for first cut, surface the limitation.
      throw new Error(`PDF appears scanned (no extractable text); vision OCR not yet implemented: ${filename}`);
    }
    return {
      title: filename,
      chunks: chunkText(full).map((c) => ({ ord: c.ord, content: c.content })),
    };
  },
};
