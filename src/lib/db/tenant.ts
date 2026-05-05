import { db } from './index';
import { sql } from 'drizzle-orm';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run a database operation under a tenant context. Sets
 * `app.current_org_id` on the transaction so RLS policies enforce
 * cross-tenant isolation. Throws if `orgId` is empty.
 *
 * Implementation note: we rely on neon-http's batched-transaction
 * semantics — every statement inside the callback ships in a single
 * HTTP transaction, which is what makes the `set_config(...)` GUC
 * visible to subsequent statements.
 */
export async function withTenant<T>(
  orgId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!orgId) throw new Error('withTenant: orgId required');
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return fn(tx);
  });
}
