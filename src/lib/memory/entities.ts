import { generateObject } from 'ai';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTenant } from '@/lib/db/tenant';
import { memoryEntities, entityLinks, sourceChunks } from '@/lib/db/schema';
import { getLanguageModel } from '@/lib/ai/router';
import { embed } from './embed';

const FUZZY_THRESHOLD = 0.4;
const SEMANTIC_THRESHOLD = 0.85;

const NER_MODEL = process.env.EXTRACTION_MODEL ?? 'anthropic/claude-haiku-4-5-20251001';

export type EntityType = 'person' | 'customer' | 'product' | 'competitor' | 'concept';

export interface EntityRef {
  id: string;
  name: string;
  canonicalName: string;
  type: EntityType;
}

const NerSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    type: z.enum(['person', 'customer', 'product', 'competitor', 'concept']),
  })),
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Resolve an entity name to its canonical row, creating one if no
 * close match exists. Match logic:
 *  1. Trigram similarity > FUZZY_THRESHOLD on name
 *  2. Embedding cosine similarity > SEMANTIC_THRESHOLD
 *
 * Caller must already be inside a withTenant() context — the `tx`
 * is the transaction handle.
 */
export async function linkEntity(
  tx: Tx,
  orgId: string,
  name: string,
  type: EntityType,
): Promise<EntityRef> {
  const trimmed = name.trim();

  const fuzzy = await tx.execute(sql`
    SELECT id, name, canonical_name, type, similarity(name, ${trimmed}) AS sim
    FROM memory_entities
    WHERE name % ${trimmed}
    ORDER BY sim DESC
    LIMIT 1
  `);
  if (fuzzy.rows.length > 0) {
    const m = fuzzy.rows[0] as { id: string; name: string; canonical_name: string; type: EntityType; sim: number };
    if (m.sim > FUZZY_THRESHOLD) {
      await tx.execute(sql`UPDATE memory_entities SET mention_count = mention_count + 1, last_seen = NOW() WHERE id = ${m.id}`);
      return { id: m.id, name: m.name, canonicalName: m.canonical_name, type: m.type };
    }
  }

  const { vector } = await embed(trimmed);
  const sem = await tx.execute(sql`
    SELECT id, name, canonical_name, type,
      1 - (embedding <=> ${JSON.stringify(vector)}::vector) AS sim
    FROM memory_entities
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${JSON.stringify(vector)}::vector
    LIMIT 1
  `);
  if (sem.rows.length > 0) {
    const m = sem.rows[0] as { id: string; name: string; canonical_name: string; type: EntityType; sim: number };
    if (m.sim > SEMANTIC_THRESHOLD) {
      await tx.execute(sql`UPDATE memory_entities SET mention_count = mention_count + 1, last_seen = NOW() WHERE id = ${m.id}`);
      return { id: m.id, name: m.name, canonicalName: m.canonical_name, type: m.type };
    }
  }

  const [created] = await tx.insert(memoryEntities).values({
    orgId,
    name: trimmed,
    canonicalName: trimmed.toLowerCase(),
    type,
    mentionCount: 1,
  }).returning();
  await tx.execute(sql`UPDATE memory_entities SET embedding = ${JSON.stringify(vector)}::vector WHERE id = ${created.id}`);
  return { id: created.id, name: created.name, canonicalName: created.canonicalName, type: created.type as EntityType };
}

export async function linkEntityToChunk(tx: Tx, orgId: string, entityId: string, chunkId: string) {
  await tx.insert(entityLinks).values({
    orgId, entityId, chunkId, relationship: 'mentioned_in',
  }).onConflictDoNothing();
}

/**
 * Run NER over every chunk in a source and link extracted entities.
 * Best-effort — failures on individual chunks are logged but don't
 * abort the whole pass.
 */
export async function extractEntitiesForSource(sourceId: string, orgId: string): Promise<{ chunks: number; linked: number }> {
  return withTenant(orgId, async (tx) => {
    const chunks = await tx
      .select({ id: sourceChunks.id, content: sourceChunks.content })
      .from(sourceChunks)
      .where(sql`${sourceChunks.sourceId} = ${sourceId}`);

    let linked = 0;
    for (const c of chunks) {
      try {
        const { object } = await generateObject({
          model: getLanguageModel(NER_MODEL),
          schema: NerSchema,
          prompt: `Extract named entities from the text below. Skip generic terms (e.g., "the team", "next quarter"). Return only specific named entities.\n\nText:\n${c.content.slice(0, 2000)}`,
        });
        for (const e of object.entities) {
          const ref = await linkEntity(tx, orgId, e.name, e.type);
          await linkEntityToChunk(tx, orgId, ref.id, c.id);
          linked++;
        }
      } catch (err) {
        console.error('[entities] NER chunk failed:', err instanceof Error ? err.message : err);
      }
    }
    return { chunks: chunks.length, linked };
  });
}
