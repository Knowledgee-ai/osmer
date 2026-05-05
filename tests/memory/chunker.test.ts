import { describe, it, expect } from 'vitest';
import { chunkText } from '@/lib/memory/chunker';

describe('chunkText', () => {
  it('returns one chunk for short content', () => {
    const out = chunkText('Hello world.');
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe('Hello world.');
  });

  it('splits long content with overlap', () => {
    const para = 'Sentence one. '.repeat(200);
    const out = chunkText(para, { maxTokens: 200, overlapTokens: 30 });
    expect(out.length).toBeGreaterThan(1);
    for (let i = 1; i < out.length; i++) {
      const prevTail = out[i - 1].content.slice(-100);
      const currHead = out[i].content.slice(0, 100);
      const intersect = [...new Set(prevTail.split(' '))].filter((w) => currHead.includes(w));
      expect(intersect.length).toBeGreaterThan(0);
    }
  });

  it('assigns sequential ords', () => {
    const para = 'Sentence one. '.repeat(100);
    const out = chunkText(para, { maxTokens: 100, overlapTokens: 10 });
    out.forEach((c, i) => expect(c.ord).toBe(i));
  });

  it('returns empty for empty input', () => {
    expect(chunkText('')).toHaveLength(0);
  });
});
