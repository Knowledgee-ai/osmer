import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { ingestSource } from '@/lib/memory/ingest';
import { organizations, users, sources, sourceChunks } from '@/lib/db/schema';
import { withTenant } from '@/lib/db/tenant';
import { eq } from 'drizzle-orm';

describe('ingestSource', () => {
  it('persists source + chunks with embeddings', async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'Ing', slug: `ing-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `u-${stamp}@e.co`, role: 'member' }).returning();

    const sourceId = await ingestSource({
      orgId: org.id,
      type: 'document',
      ownerUserId: user.id,
      title: 'Test doc',
      chunks: [
        { ord: 0, content: 'Acme uses Stripe.' },
        { ord: 1, content: 'They are migrating to Adyen in Q3.' },
      ],
    });

    // Read back inside the tenant context (RLS forces it).
    const inside = await withTenant(org.id, async (tx) => {
      const src = await tx.select().from(sources).where(eq(sources.id, sourceId));
      const ch = await tx.select().from(sourceChunks).where(eq(sourceChunks.sourceId, sourceId));
      return { src, ch };
    });
    expect(inside.src).toHaveLength(1);
    expect(inside.src[0].type).toBe('document');
    expect(inside.ch).toHaveLength(2);
    expect(inside.ch[0].embeddingVersion).toBe(1);
  });
});
