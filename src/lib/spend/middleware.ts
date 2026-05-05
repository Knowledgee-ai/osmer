import { assertSpendOk, recordSpend, SpendExceeded, type SpendKind } from './caps';

/**
 * Wrap a model-call surface in spend gates. Pre-flight asserts the
 * estimated cost would not exceed user_daily / org_monthly / per-run
 * caps; on success, records the actual cost into spend_ledger.
 *
 * Throws SpendExceeded with the offending scope. Caller decides
 * whether to surface as a 402 to the user.
 */
export async function withSpendGuard<T>(
  ctx: { orgId: string; userId: string | null; kind: SpendKind; estCents: number },
  fn: () => Promise<{ result: T; actualCents: number }>,
): Promise<T> {
  const dailyScope = ctx.kind === 'employee_run' ? 'employee_run' : 'user_daily';
  if (ctx.userId) await assertSpendOk(ctx.orgId, ctx.userId, dailyScope, ctx.estCents);
  await assertSpendOk(ctx.orgId, ctx.userId, 'org_monthly', ctx.estCents);

  const { result, actualCents } = await fn();
  await recordSpend(ctx.orgId, ctx.userId, ctx.kind, actualCents);
  return result;
}

export { SpendExceeded } from './caps';
