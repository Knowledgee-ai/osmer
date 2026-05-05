import mammoth from 'mammoth';
import { chunkText } from '@/lib/memory/chunker';
import type { Parser } from '../types';

export const docxParser: Parser = {
  matches: (mime, name) =>
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.toLowerCase().endsWith('.docx'),
  async parse(buffer, filename) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return {
      title: filename,
      chunks: chunkText(value).map((c) => ({ ord: c.ord, content: c.content })),
    };
  },
};
