import { embed as embedV2 } from '@/lib/memory/embed';

/**
 * @deprecated Use `src/lib/memory/embed.ts`. Removed in M3.
 *
 * Kept as a thin shim so any remaining legacy callers continue to
 * work during the M1→M3 transition. Returns just the vector for
 * backwards compatibility; the new API returns `{ vector, version }`.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { vector } = await embedV2(text);
  return vector;
}
