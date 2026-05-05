import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { ingestSource } from '@/lib/memory/ingest';
import { retrieve, retrieveSemantic, retrieveLexical } from '@/lib/memory/retrieve';
import type { RetrievalScope } from '@/lib/memory/types';

describe('retrieve (hybrid)', () => {
  let orgId: string;
  let userId: string;
  let scope: RetrievalScope;

  beforeAll(async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'R', slug: `r-${stamp}` }).returning();
    const [u] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `r-${stamp}@e.co`, role: 'member' }).returning();
    orgId = org.id; userId = u.id;
    scope = { userId, teamIds: [], orgId, includeOrg: true };

    await ingestSource({
      orgId, type: 'document', ownerUserId: userId, title: 'mix',
      chunks: [
        { ord: 0, content: 'Acme migrated from Stripe to Adyen in March of last year.' },
        { ord: 1, content: 'The office coffee preference remains Blue Bottle.' },
        { ord: 2, content: 'SKU-AC-9912 has been discontinued and replaced by SKU-AC-9913.' },
      ],
    });
  });

  it('semantic leg ranks payment chunk first for a payments query', async () => {
    const r = await retrieveSemantic({ query: 'How does Acme handle payments?', scope, limit: 5 });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].content).toMatch(/Stripe|Adyen|payment|migrated/i);
  });

  it('lexical leg finds an exact SKU token', async () => {
    const r = await retrieveLexical({ query: 'SKU-AC-9912', scope, limit: 5 });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].content).toContain('SKU-AC-9912');
  });

  it('unified retrieve returns top-N with finalScore + signals', async () => {
    const r = await retrieve({ query: 'Acme payment processor', scope, topN: 3 });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].content).toMatch(/Stripe|Adyen|Acme/i);
    expect(r[0].finalScore).toBeGreaterThan(0);
    expect(r[0].signals.length).toBeGreaterThan(0);
  });
});
