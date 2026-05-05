import { describe, it, expect } from 'vitest';
import { embed, currentEmbeddingVersion, EMBEDDING_DIM } from '@/lib/memory/embed';

describe('embed', () => {
  it('returns a 1536-dim vector with the current version', async () => {
    const { vector, version } = await embed('Acme uses Stripe for payments');
    expect(vector.length).toBe(EMBEDDING_DIM);
    expect(version).toBe(currentEmbeddingVersion);
    expect(vector.every((n) => typeof n === 'number')).toBe(true);
  });

  it('produces stable embeddings for the same input', async () => {
    const a = await embed('hello world');
    const b = await embed('hello world');
    const dot = a.vector.reduce((s, v, i) => s + v * b.vector[i], 0);
    expect(dot).toBeGreaterThan(0.99);
  });

  it('throws on unknown version', async () => {
    await expect(embed('x', 99)).rejects.toThrow(/unknown embedding version/);
  });
});
