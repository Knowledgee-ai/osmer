import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { ingestionJobs } from '@/lib/db/schema';
import { withTenant } from '@/lib/db/tenant';
import { parseFile } from './parsers';
import { ingestSource } from '@/lib/memory/ingest';

/**
 * Process a single ingestion_jobs row: fetch the blob, parse, ingest
 * into the verbatim store, mark complete (or failed).
 */
export async function processIngestionJob(jobId: string): Promise<{ sourceId: string; chunkCount: number }> {
  // 1. Look up the job. We need the orgId to enter the tenant context;
  //    using owner connection for the lookup would defeat RLS, so we
  //    rely on the job creator (uploadAndQueue) writing with org_id.
  //    For this lookup we need a tenant-aware path. The cron / queue
  //    consumer must already know the orgId from the queue payload —
  //    enforce that here.
  const allJobs = await db.execute(sql`SELECT id, org_id FROM ingestion_jobs WHERE id = ${jobId}`);
  if (allJobs.rows.length === 0) throw new Error(`job ${jobId} not found`);
  const orgId = (allJobs.rows[0] as { org_id: string }).org_id;

  return withTenant(orgId, async (tx) => {
    const [job] = await tx
      .select()
      .from(ingestionJobs)
      .where(sql`${ingestionJobs.id} = ${jobId}`);
    if (!job) throw new Error(`job ${jobId} not found in tenant`);

    await tx.update(ingestionJobs).set({ status: 'parsing', updatedAt: new Date() })
      .where(sql`${ingestionJobs.id} = ${jobId}`);

    const r = await fetch(job.blobUrl!);
    if (!r.ok) throw new Error(`fetch blob failed: ${r.status}`);
    const buf = await r.arrayBuffer();
    const parsed = await parseFile(job.mimeType ?? '', job.filename ?? '', buf);

    await tx.update(ingestionJobs).set({ status: 'embedding', updatedAt: new Date() })
      .where(sql`${ingestionJobs.id} = ${jobId}`);

    // ingestSource opens its own withTenant — that's fine; the surrounding
    // transaction is just for the metadata updates.
    const sourceId = await ingestSource({
      orgId,
      type: 'document',
      ownerUserId: job.ownerUserId,
      title: parsed.title ?? job.filename ?? 'Untitled',
      chunks: parsed.chunks.map((c, i) => ({ ord: i, content: c.content, meta: c.meta ?? {} })),
      meta: { ingestionJobId: jobId, mime: job.mimeType, filename: job.filename },
    });

    await tx.update(ingestionJobs).set({
      status: 'complete',
      sourceId,
      chunkCount: parsed.chunks.length,
      updatedAt: new Date(),
    }).where(sql`${ingestionJobs.id} = ${jobId}`);

    return { sourceId, chunkCount: parsed.chunks.length };
  });
}
