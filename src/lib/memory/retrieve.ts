import { sql } from 'drizzle-orm';
import { embed } from './embed';
import { withTenant } from '@/lib/db/tenant';
import { rerank } from './rerank';
import { withSpan } from '@/lib/observability/otel';
import type { RetrievalCandidate, RetrievalResult, RetrievalScope } from './types';

interface RetrieveOpts {
  query: string;
  scope: RetrievalScope;
  limit?: number;
  asOf?: Date;
}

interface UnifiedRetrieveOpts extends RetrieveOpts {
  topN?: number;
}

function asOfFilter(asOf: Date | undefined) {
  if (!asOf) return sql`TRUE`;
  return sql`(valid_at <= ${asOf.toISOString()}::timestamptz AND (invalid_at IS NULL OR invalid_at > ${asOf.toISOString()}::timestamptz))`;
}

/**
 * Semantic leg — pgvector cosine over chunk embeddings (HNSW).
 */
export async function retrieveSemantic(opts: RetrieveOpts): Promise<RetrievalCandidate[]> {
  const limit = opts.limit ?? 30;
  const { vector } = await embed(opts.query);
  const vecLit = JSON.stringify(vector);

  const rows = await withTenant(opts.scope.orgId, async (tx) => {
    return tx.execute(sql`
      SELECT id, source_id, content, speaker_user_id, valid_at, meta,
        1 - (embedding <=> ${vecLit}::vector) AS sim
      FROM source_chunks
      WHERE ${asOfFilter(opts.asOf)}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vecLit}::vector
      LIMIT ${limit}
    `);
  });

  return (rows.rows as Array<{
    id: string; source_id: string; content: string;
    speaker_user_id: string | null; valid_at: Date;
    meta: Record<string, unknown>; sim: number;
  }>).map((r) => ({
    chunkId: r.id,
    sourceId: r.source_id,
    content: r.content,
    signal: 'semantic',
    rawScore: r.sim,
    speakerUserId: r.speaker_user_id,
    validAt: r.valid_at,
    meta: r.meta,
  }));
}

/**
 * Lexical leg — Postgres full-text search over the generated tsv column.
 * Catches exact account names, SKUs, technical terms.
 */
export async function retrieveLexical(opts: RetrieveOpts): Promise<RetrievalCandidate[]> {
  const limit = opts.limit ?? 30;
  const rows = await withTenant(opts.scope.orgId, async (tx) => {
    return tx.execute(sql`
      SELECT id, source_id, content, speaker_user_id, valid_at, meta,
        ts_rank_cd(tsv, plainto_tsquery('english', ${opts.query})) AS rank
      FROM source_chunks
      WHERE ${asOfFilter(opts.asOf)}
        AND tsv @@ plainto_tsquery('english', ${opts.query})
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
  });

  return (rows.rows as Array<{
    id: string; source_id: string; content: string;
    speaker_user_id: string | null; valid_at: Date;
    meta: Record<string, unknown>; rank: number;
  }>).map((r) => ({
    chunkId: r.id,
    sourceId: r.source_id,
    content: r.content,
    signal: 'lexical',
    rawScore: r.rank,
    speakerUserId: r.speaker_user_id,
    validAt: r.valid_at,
    meta: r.meta,
  }));
}

/**
 * Entity leg — pull capitalized tokens from the query, fuzzy-match
 * against memory_entities, return chunks linked to those entities.
 */
export async function retrieveByEntity(opts: RetrieveOpts): Promise<RetrievalCandidate[]> {
  const limit = opts.limit ?? 30;
  const tokens = (opts.query.match(/\b[A-Z][a-zA-Z0-9._-]{2,}\b/g) ?? []).slice(0, 3);
  if (tokens.length === 0) return [];

  return withTenant(opts.scope.orgId, async (tx) => {
    const out: RetrievalCandidate[] = [];
    for (const t of tokens) {
      const fuzzy = await tx.execute(sql`
        SELECT id FROM memory_entities
        WHERE name % ${t}
        ORDER BY similarity(name, ${t}) DESC
        LIMIT 1
      `);
      if (fuzzy.rows.length === 0) continue;
      const entityId = (fuzzy.rows[0] as { id: string }).id;

      const chunks = await tx.execute(sql`
        SELECT c.id, c.source_id, c.content, c.speaker_user_id, c.valid_at, c.meta
        FROM source_chunks c
        JOIN entity_links l ON l.chunk_id = c.id AND l.entity_id = ${entityId}
        WHERE ${asOfFilter(opts.asOf)}
        ORDER BY c.valid_at DESC
        LIMIT ${limit}
      `);
      for (const r of chunks.rows as Array<{ id: string; source_id: string; content: string; speaker_user_id: string | null; valid_at: Date; meta: Record<string, unknown> }>) {
        out.push({
          chunkId: r.id,
          sourceId: r.source_id,
          content: r.content,
          signal: 'entity',
          rawScore: 1.0,
          speakerUserId: r.speaker_user_id,
          validAt: r.valid_at,
          meta: r.meta,
        });
      }
    }
    return out;
  });
}

/**
 * Unified hybrid retrieval. Runs all three signals in parallel,
 * fuses + reranks, returns top-N final results with provenance.
 */
export async function retrieve(opts: UnifiedRetrieveOpts): Promise<RetrievalResult[]> {
  return withSpan('memory.retrieve', async (span) => {
    span.setAttribute('topN', opts.topN ?? 8);
    span.setAttribute('hasAsOf', !!opts.asOf);
    const [sem, lex, ent] = await Promise.all([
      retrieveSemantic(opts).catch(() => []),
      retrieveLexical(opts).catch(() => []),
      retrieveByEntity(opts).catch(() => []),
    ]);
    span.setAttribute('candidates.semantic', sem.length);
    span.setAttribute('candidates.lexical', lex.length);
    span.setAttribute('candidates.entity', ent.length);
    return rerank({ query: opts.query, candidates: [...sem, ...lex, ...ent], topN: opts.topN ?? 8 });
  });
}
