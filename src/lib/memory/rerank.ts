import type { RetrievalCandidate, RetrievalResult, RetrievalSignal } from './types';

const RERANK_MODEL = 'rerank-english-v3.0';

interface RerankOpts {
  query: string;
  candidates: RetrievalCandidate[];
  topN?: number;
}

/**
 * Cross-encoder rerank via Cohere. Falls back to weighted reciprocal-rank
 * fusion (RRF) when no Cohere API key is configured — same shape, lower
 * quality, but the system still works.
 */
export async function rerank({ query, candidates, topN = 8 }: RerankOpts): Promise<RetrievalResult[]> {
  if (candidates.length === 0) return [];

  // Dedupe by chunkId, retain all signals as scoring inputs
  const byId = new Map<string, RetrievalCandidate[]>();
  for (const c of candidates) {
    const arr = byId.get(c.chunkId) ?? [];
    arr.push(c);
    byId.set(c.chunkId, arr);
  }
  const merged = Array.from(byId.entries()).map(([chunkId, sigs]) => ({ chunkId, sigs, sample: sigs[0] }));

  if (process.env.COHERE_API_KEY && merged.length > 1) {
    try {
      return await rerankCohere(query, merged, topN);
    } catch {
      // Fall through to RRF on any Cohere error
    }
  }

  return rrfFuse(candidates, merged, topN);
}

/**
 * Recency boost: a chunk's score is multiplied by `(0.7 + 0.3 * decay)`
 * where decay = exp(-days_since / 60). At 0 days it's 1.0; at 60 days
 * it's ~0.81; at 6 months it's ~0.74. Strong enough to break ties
 * between v1 / v2 versions of the same fact, weak enough not to bury
 * historically important chunks.
 */
function recencyMultiplier(validAt: Date): number {
  const daysAgo = Math.max(0, (Date.now() - new Date(validAt).getTime()) / 86_400_000);
  const decay = Math.exp(-daysAgo / 60);
  return 0.7 + 0.3 * decay;
}

async function rerankCohere(
  query: string,
  merged: Array<{ chunkId: string; sigs: RetrievalCandidate[]; sample: RetrievalCandidate }>,
  topN: number,
): Promise<RetrievalResult[]> {
  const docs = merged.map((m) => m.sample.content);
  const r = await fetch('https://api.cohere.com/v2/rerank', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.COHERE_API_KEY}` },
    body: JSON.stringify({ model: RERANK_MODEL, query, documents: docs, top_n: docs.length }),
  });
  if (!r.ok) throw new Error(`cohere rerank ${r.status}`);
  const j = await r.json() as { results: Array<{ index: number; relevance_score: number }> };

  // Apply recency boost on top of Cohere relevance, then re-sort + slice.
  const out = j.results.map((res) => {
    const m = merged[res.index];
    const boost = recencyMultiplier(m.sample.validAt);
    return {
      chunkId: m.chunkId,
      sourceId: m.sample.sourceId,
      content: m.sample.content,
      finalScore: res.relevance_score * boost,
      signals: m.sigs.map((s) => ({ kind: s.signal, score: s.rawScore })),
      speakerUserId: m.sample.speakerUserId,
      validAt: m.sample.validAt,
      meta: m.sample.meta,
    };
  });
  out.sort((a, b) => b.finalScore - a.finalScore);
  return out.slice(0, topN);
}

function rrfFuse(
  all: RetrievalCandidate[],
  merged: Array<{ chunkId: string; sigs: RetrievalCandidate[]; sample: RetrievalCandidate }>,
  topN: number,
): RetrievalResult[] {
  const ranksBySignal: Record<RetrievalSignal, Map<string, number>> = {
    semantic: new Map(), lexical: new Map(), entity: new Map(),
  };
  for (const sig of ['semantic', 'lexical', 'entity'] as RetrievalSignal[]) {
    const sorted = all.filter((c) => c.signal === sig).sort((a, b) => b.rawScore - a.rawScore);
    sorted.forEach((c, i) => ranksBySignal[sig].set(c.chunkId, i + 1));
  }

  const rrf = merged.map((m) => {
    let score = 0;
    for (const sig of ['semantic', 'lexical', 'entity'] as RetrievalSignal[]) {
      const r = ranksBySignal[sig].get(m.chunkId);
      if (r != null) score += 1 / (60 + r);
    }
    return {
      chunkId: m.chunkId,
      sourceId: m.sample.sourceId,
      content: m.sample.content,
      finalScore: score * recencyMultiplier(m.sample.validAt),
      signals: m.sigs.map((s) => ({ kind: s.signal, score: s.rawScore })),
      speakerUserId: m.sample.speakerUserId,
      validAt: m.sample.validAt,
      meta: m.sample.meta,
    };
  });
  rrf.sort((a, b) => b.finalScore - a.finalScore);
  return rrf.slice(0, topN);
}
