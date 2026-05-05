import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTenant } from '@/lib/db/tenant';
import { organizations } from '@/lib/db/schema';

const SIM_THRESHOLD = 0.85;

/**
 * Weekly: find pairs of active atoms with high similarity but
 * different content (proxy for contradiction). The newer one wins;
 * the older is archived with supersedes_id pointing at the winner.
 */
export async function runDisagreement() {
  const orgs = await db.select({ id: organizations.id }).from(organizations);
  let archived = 0;
  for (const o of orgs) {
    await withTenant(o.id, async (tx) => {
      const pairs = await tx.execute(sql`
        SELECT a.id AS new_id, b.id AS old_id
        FROM memory_atoms a
        JOIN memory_atoms b
          ON a.type = b.type
         AND a.status = 'active' AND b.status = 'active'
         AND a.created_at > b.created_at
         AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
         AND 1 - (a.embedding <=> b.embedding) > ${SIM_THRESHOLD}
         AND a.content <> b.content
        LIMIT 100
      `);
      for (const r of pairs.rows as Array<{ new_id: string; old_id: string }>) {
        await tx.execute(sql`
          UPDATE memory_atoms SET status = 'superseded', invalid_at = NOW(), updated_at = NOW()
          WHERE id = ${r.old_id}
        `);
        await tx.execute(sql`
          UPDATE memory_atoms SET supersedes_id = ${r.old_id}
          WHERE id = ${r.new_id}
        `);
        archived++;
      }
    });
  }
  return { archived };
}
