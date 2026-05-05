import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTenant } from '@/lib/db/tenant';
import { organizations, memorySnapshots } from '@/lib/db/schema';

/**
 * Weekly: write a health snapshot per org. The Memory Map (M5) replaces
 * this with full graph snapshots; for M1 we just record metrics.
 */
export async function runHealth() {
  const orgs = await db.select({ id: organizations.id }).from(organizations);
  let written = 0;
  for (const o of orgs) {
    await withTenant(o.id, async (tx) => {
      const stats = await tx.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM source_chunks) AS chunks,
          (SELECT COUNT(*) FROM memory_atoms WHERE status = 'active') AS active_atoms,
          (SELECT COUNT(*) FROM memory_atoms WHERE status = 'stale')  AS stale_atoms,
          (SELECT COUNT(DISTINCT scope_user_id) FROM memory_atoms WHERE scope_user_id IS NOT NULL) AS contributors
      `);
      const row = stats.rows[0] as Record<string, number | string>;
      await tx.insert(memorySnapshots).values({
        orgId: o.id,
        nodes: { metrics: row },
        edges: {},
        contributorWeights: {},
        topicClusters: {},
      });
      written++;
    });
  }
  return { snapshots: written };
}
