import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { parseFile } from '@/lib/ingest/parsers';
import { ingestSource } from '@/lib/memory/ingest';
import { withTenant } from '@/lib/db/tenant';
import { sql } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Cold-start acceptance: a fresh org goes from zero memory to a
 * non-trivial chunk count via document parse + ingest. Skips the
 * Vercel Blob upload (storage requires BLOB_READ_WRITE_TOKEN; the
 * upload path is exercised in production deploys). Tests the same
 * processing pipeline that fires after the blob is fetched.
 */
describe('M2 cold-start', () => {
  it('takes a fresh org from zero to indexed memory via document parse + ingest', async () => {
    const stamp = Date.now();
    const [org]  = await db.insert(organizations).values({ name: 'Cold', slug: `cold-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'Founder', email: `cold-${stamp}@e.co`, role: 'owner' }).returning();

    const buf = await fs.readFile(path.resolve(__dirname, 'fixtures/sample.md'));
    const parsed = await parseFile('text/markdown', 'sample.md', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    expect(parsed.chunks.length).toBeGreaterThanOrEqual(1);
    // The fixture is a real Q1 plan; it has substance.
    expect(parsed.chunks[0].content.length).toBeGreaterThan(500);
    expect(parsed.title).toBe('Acme Corp Q1 Plan');

    const sourceId = await ingestSource({
      orgId: org.id,
      type: 'document',
      ownerUserId: user.id,
      title: parsed.title ?? 'sample',
      chunks: parsed.chunks.map((c, i) => ({ ord: i, content: c.content, meta: c.meta ?? {} })),
    });
    expect(sourceId).toBeTruthy();

    const counts = await withTenant(org.id, async (tx) => {
      const c = await tx.execute(sql`SELECT COUNT(*) AS c FROM source_chunks WHERE source_id = ${sourceId}::uuid`);
      const labels = await tx.execute(sql`
        SELECT COUNT(*) AS c FROM chunk_pii_labels
        WHERE chunk_id IN (SELECT id FROM source_chunks WHERE source_id = ${sourceId}::uuid)
      `);
      return {
        chunks: Number((c.rows[0] as { c: number }).c),
        labels: Number((labels.rows[0] as { c: number }).c),
      };
    });

    expect(counts.chunks).toBeGreaterThanOrEqual(1);
    // Every chunk got a PII label row (severity may be 'none')
    expect(counts.labels).toBe(counts.chunks);
  }, 120_000);
});
