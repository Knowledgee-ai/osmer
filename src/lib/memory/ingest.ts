import { sources, sourceChunks, chunkPiiLabels } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { embedBatch } from './embed';
import { withTenant } from '@/lib/db/tenant';
import { detectPii } from '@/lib/ingest/pii';
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

    // 2. Embed + classify in parallel. PII detection is best-effort —
    //    a failure shouldn't block ingest, the chunk just lands as 'none'.
    const [embeddings, piiLabels] = await Promise.all([
      embedBatch(chunks.map((c) => c.content)),
      Promise.all(chunks.map((c) => detectPii(c.content).catch(() => ({ severity: 'none' as const, categories: [], spans: [], detectorVersion: 1 })))),
    ]);

    // 3. Insert chunks + embedding + PII label rows.
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const e = embeddings[i];
      const pii = piiLabels[i];
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

      await tx.insert(chunkPiiLabels).values({
        chunkId: row.id,
        orgId,
        severity: pii.severity,
        categories: pii.categories,
        spans: pii.spans,
        detectorVersion: pii.detectorVersion,
      });
    }

    return src.id;
  });
}
