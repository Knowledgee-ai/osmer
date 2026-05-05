import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';
import { sources, organizations } from '@/lib/db/schema';

describe('withTenant', () => {
  it('isolates queries to the configured org', async () => {
    const stamp = Date.now();
    const [orgA] = await db.insert(organizations).values({ name: 'A', slug: `t-a-${stamp}` }).returning();
    const [orgB] = await db.insert(organizations).values({ name: 'B', slug: `t-b-${stamp}` }).returning();
    // Insertions need a tenant context now that RLS is on (and the policy WITH CHECK enforces org_id).
    await withTenant(orgA.id, (tx) => tx.insert(sources).values({ orgId: orgA.id, type: 'conversation', title: `A-only-${stamp}` }).returning());
    await withTenant(orgB.id, (tx) => tx.insert(sources).values({ orgId: orgB.id, type: 'conversation', title: `B-only-${stamp}` }).returning());

    const visibleA = await withTenant(orgA.id, async (tx) => {
      return tx.execute(sql`SELECT title FROM sources WHERE title LIKE ${`%-only-${stamp}`}`);
    });
    const titles = (visibleA.rows as Array<{ title: string }>).map((r) => r.title);
    expect(titles).toContain(`A-only-${stamp}`);
    expect(titles).not.toContain(`B-only-${stamp}`);
  });
});
