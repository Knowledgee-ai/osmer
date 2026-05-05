import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users, spendCaps } from '@/lib/db/schema';
import { withTenant } from '@/lib/db/tenant';
import { assertSpendOk, recordSpend, SpendExceeded } from '@/lib/spend/caps';
import { withSpendGuard } from '@/lib/spend/middleware';

describe('spend caps', () => {
  it('throws SpendExceeded when user_daily cap is reached', async () => {
    const stamp = Date.now();
    const [org]  = await db.insert(organizations).values({ name: 'C', slug: `c-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `c-${stamp}@e.co`, role: 'member' }).returning();
    await withTenant(org.id, (tx) => tx.insert(spendCaps).values({ orgId: org.id, userId: user.id, scope: 'user_daily', capCents: 100 }));
    await recordSpend(org.id, user.id, 'chat', 95);
    await expect(assertSpendOk(org.id, user.id, 'user_daily', 10)).rejects.toBeInstanceOf(SpendExceeded);
  });

  it('withSpendGuard runs work and records actual cost', async () => {
    const stamp = Date.now();
    const [org]  = await db.insert(organizations).values({ name: 'G', slug: `g-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `g-${stamp}@e.co`, role: 'member' }).returning();

    const out = await withSpendGuard(
      { orgId: org.id, userId: user.id, kind: 'chat', estCents: 5 },
      async () => ({ result: 42, actualCents: 7 }),
    );
    expect(out).toBe(42);

    // Ledger should now hold a 7-cent chat row
    const total = await withTenant(org.id, async (tx) => {
      const r = await tx.execute(`SELECT SUM(cents)::int AS s FROM spend_ledger WHERE user_id = '${user.id}'` as never);
      return Number((r.rows[0] as { s: number }).s);
    });
    expect(total).toBe(7);
  });
});
