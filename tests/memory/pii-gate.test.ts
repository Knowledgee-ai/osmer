import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { ingestSource } from '@/lib/memory/ingest';
import { withTenant } from '@/lib/db/tenant';
import { sql } from 'drizzle-orm';

describe('PII gate at ingest', () => {
  it('persists severity=high label for chunks with card-shaped content', async () => {
    const stamp = Date.now();
    const [org]  = await db.insert(organizations).values({ name: 'P', slug: `pii-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `pii-${stamp}@e.co`, role: 'member' }).returning();

    const sourceId = await ingestSource({
      orgId: org.id,
      type: 'document',
      ownerUserId: user.id,
      title: 'sensitive',
      chunks: [
        { ord: 0, content: 'Payment failed; card on file is 4111-1111-1111-1111.' },
        { ord: 1, content: 'We agreed on quarterly billing for the engagement.' },
      ],
    });

    const labels = await withTenant(org.id, async (tx) => {
      return tx.execute(sql`
        SELECT c.content, p.severity
        FROM source_chunks c
        JOIN chunk_pii_labels p ON p.chunk_id = c.id
        WHERE c.source_id = ${sourceId}
        ORDER BY c.ord
      `);
    });
    const rows = labels.rows as Array<{ content: string; severity: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0].severity).toBe('high');
    expect(rows[1].severity).toBe('none');
  });
});
