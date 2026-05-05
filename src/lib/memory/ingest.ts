import { sources, sourceChunks } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { embedBatch } from './embed';
import { withTenant } from '@/lib/db/tenant';
import type { IngestRequest } from './types';

/**
 * Persist a source and its chunks with embeddings under a tenant
 * context (RLS-bound). Returns the source id. If `sourceId` is
 * provided, upserts the source (used by conversations whose source
 * id mirrors the conversation id).
 */
export async function ingestSource(req: IngestRequest): Promise<string> {
  const { orgId, type, ownerUserId, title, meta = {}, chunks, sourceId } = req;

  return withTenant(orgId, async (tx) => {
    // 1. Create or upsert the source row
    const [src] = await tx
      .insert(sources)
      .values({
        id: sourceId,
        orgId,
        ownerUserId,
        type,
        title: title ?? null,
        meta,
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: { updatedAt: new Date(), title: title ?? sql`${sources.title}` },
      })
      .returning({ id: sources.id });

    if (chunks.length === 0) return src.id;

    // 2. Embed chunks in parallel (outside tx, just CPU-light awaits on AI Gateway)
    const embeddings = await embedBatch(chunks.map((c) => c.content));

    // 3. Insert chunks; update embedding via raw SQL (vector type isn't a Drizzle column)
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const e = embeddings[i];
      const [row] = await tx
        .insert(sourceChunks)
        .values({
          sourceId: src.id,
          orgId,
          ord: c.ord,
          role: c.role ?? null,
          speakerUserId: c.speakerUserId ?? null,
          content: c.content,
          tokenCount: Math.ceil(c.content.length / 4),
          embeddingVersion: e.version,
          meta: c.meta ?? {},
        })
        .returning({ id: sourceChunks.id });

      await tx.execute(
        sql`UPDATE source_chunks SET embedding = ${JSON.stringify(e.vector)}::vector WHERE id = ${row.id}`,
      );
    }

    return src.id;
  });
}
