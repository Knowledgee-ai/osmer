import { db } from '@/lib/db';
import { spendCaps, spendLedger } from '@/lib/db/schema';
import { sql, and, eq } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

const DEFAULTS_CENTS: Record<string, number> = {
  user_daily: 500,        // $5/day
  org_monthly: 50000,     // $500/month
  employee_run: 200,      // $2/run
};

export type SpendKind = 'chat' | 'embedding' | 'projection' | 'employee_run' | 'pii_detect' | 'crawl' | 'extraction';
export type CapScope = 'user_daily' | 'org_monthly' | 'employee_run';

export class SpendExceeded extends Error {
  constructor(public scope: CapScope, public cap: number, public used: number) {
    super(`spend cap exceeded for ${scope}: cap=${cap}c used=${used}c`);
  }
}

/**
 * Throws SpendExceeded if running this would push the user / org over
 * the configured cap. Cheap path: one query per scope.
 */
export async function assertSpendOk(orgId: string, userId: string | null, scope: CapScope, estCents: number): Promise<void> {
  if (scope === 'user_daily' && userId) {
    const cap = await capCents(orgId, userId, 'user_daily');
    const used = await spentSince(orgId, userId, since('day'));
    if (used + estCents > cap) throw new SpendExceeded('user_daily', cap, used);
  }
  if (scope === 'org_monthly') {
    const cap = await capCents(orgId, null, 'org_monthly');
    const used = await spentSince(orgId, null, since('month'));
    if (used + estCents > cap) throw new SpendExceeded('org_monthly', cap, used);
  }
  if (scope === 'employee_run') {
    const cap = await capCents(orgId, null, 'employee_run');
    if (estCents > cap) throw new SpendExceeded('employee_run', cap, estCents);
  }
}

export async function recordSpend(
  orgId: string,
  userId: string | null,
  kind: SpendKind,
  cents: number,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await withTenant(orgId, async (tx) => {
    await tx.insert(spendLedger).values({ orgId, userId, kind, cents, meta });
  });
}

async function capCents(orgId: string, userId: string | null, scope: CapScope): Promise<number> {
  const rows = await withTenant(orgId, async (tx) => {
    return tx
      .select()
      .from(spendCaps)
      .where(
        userId
          ? and(eq(spendCaps.orgId, orgId), eq(spendCaps.userId, userId), eq(spendCaps.scope, scope))
          : and(eq(spendCaps.orgId, orgId), sql`user_id IS NULL`, eq(spendCaps.scope, scope)),
      );
  });
  if (rows.length > 0) return rows[0].capCents;
  return DEFAULTS_CENTS[scope] ?? 0;
}

async function spentSince(orgId: string, userId: string | null, since: Date): Promise<number> {
  const r = await withTenant(orgId, async (tx) => {
    return tx.execute(sql`
      SELECT COALESCE(SUM(cents), 0)::int AS s FROM spend_ledger
      WHERE ts >= ${since.toISOString()}
        ${userId ? sql`AND user_id = ${userId}` : sql``}
    `);
  });
  return Number((r.rows[0] as { s: number }).s);
}

function since(period: 'day' | 'month'): Date {
  const d = new Date();
  if (period === 'day') d.setUTCHours(0, 0, 0, 0);
  else { d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); }
  return d;
}
