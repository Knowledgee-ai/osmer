import { chunkText } from '@/lib/memory/chunker';
import type { Parser } from '../types';

export const markdownParser: Parser = {
  matches: (mime, name) =>
    mime === 'text/markdown' ||
    name.endsWith('.md') ||
    name.endsWith('.mdx') ||
    mime === 'text/plain' ||
    name.endsWith('.txt'),
  async parse(buffer, filename) {
    const text = new TextDecoder().decode(buffer);
    const titleMatch = text.match(/^#\s+(.+)$/m);
    return {
      title: titleMatch ? titleMatch[1].trim() : filename,
      chunks: chunkText(text).map((c) => ({ ord: c.ord, content: c.content })),
    };
  },
};
