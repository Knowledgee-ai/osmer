import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users, sources } from '@/lib/db/schema';
import { ingestSource } from '@/lib/memory/ingest';
import { retrieve } from '@/lib/memory/retrieve';
import { withTenant } from '@/lib/db/tenant';
import { sql } from 'drizzle-orm';

describe('RLS — cross-tenant isolation', () => {
  it('a user under orgA cannot see orgB chunks via retrieve()', async () => {
    const stamp = Date.now();
    const [orgA] = await db.insert(organizations).values({ name: 'A', slug: `rls-a-${stamp}` }).returning();
    const [orgB] = await db.insert(organizations).values({ name: 'B', slug: `rls-b-${stamp}` }).returning();
    const [userA] = await db.insert(users).values({ orgId: orgA.id, name: 'A', email: `rls-a-${stamp}@e.co`, role: 'member' }).returning();
    const [userB] = await db.insert(users).values({ orgId: orgB.id, name: 'B', email: `rls-b-${stamp}@e.co`, role: 'member' }).returning();

    await ingestSource({ orgId: orgA.id, type: 'document', ownerUserId: userA.id, title: 'A-secret', chunks: [{ ord: 0, content: `Org A secret token: ALPHA-${stamp}` }] });
    await ingestSource({ orgId: orgB.id, type: 'document', ownerUserId: userB.id, title: 'B-secret', chunks: [{ ord: 0, content: `Org B secret token: BETA-${stamp}` }] });

    // From within orgA's tenant context, only A's chunks are visible.
    const visibleA = await withTenant(orgA.id, async (tx) => {
      return tx.execute(sql`SELECT content FROM source_chunks WHERE content LIKE ${`Org % secret token: %-${stamp}`}`);
    });
    const contents = (visibleA.rows as Array<{ content: string }>).map((r) => r.content);
    expect(contents.some((c) => c.includes(`ALPHA-${stamp}`))).toBe(true);
    expect(contents.some((c) => c.includes(`BETA-${stamp}`))).toBe(false);

    // retrieve() — user under orgA querying for B's secret returns nothing.
    const r = await retrieve({
      query: `BETA-${stamp}`,
      scope: { userId: userA.id, teamIds: [], orgId: orgA.id, includeOrg: true },
      topN: 5,
    });
    const fromB = r.find((x) => x.content.includes(`BETA-${stamp}`));
    expect(fromB).toBeUndefined();
  });

  it('insert into a foreign org_id is rejected by the WITH CHECK clause', async () => {
    const stamp = Date.now();
    const [orgA] = await db.insert(organizations).values({ name: 'A', slug: `rls-c-${stamp}` }).returning();
    const [orgB] = await db.insert(organizations).values({ name: 'B', slug: `rls-d-${stamp}` }).returning();

    let blocked = false;
    try {
      await withTenant(orgA.id, async (tx) => {
        // Attempt to insert a source with orgId = B while the tenant context is A.
        // RLS WITH CHECK should reject.
        await tx.insert(sources).values({ orgId: orgB.id, type: 'document', title: `xbleed-${stamp}` });
      });
    } catch {
      blocked = true;
    }
    expect(blocked).toBe(true);
  });
});
