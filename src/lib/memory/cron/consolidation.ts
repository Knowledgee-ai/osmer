import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTenant } from '@/lib/db/tenant';
import { organizations } from '@/lib/db/schema';

const MERGE_SIM = 0.95;

/**
 * Weekly: merge near-duplicate active atoms (same type, similarity
 * >= 0.95). Keeper is the one with the higher affirmed_count;
 * the loser is archived with supersedes_id pointing at the keeper.
 */
export async function runConsolidation() {
  const orgs = await db.select({ id: organizations.id }).from(organizations);
  let merged = 0;
  for (const o of orgs) {
    await withTenant(o.id, async (tx) => {
      const candidates = await tx.execute(sql`
        SELECT a.id AS keep_id, b.id AS drop_id
        FROM memory_atoms a
        JOIN memory_atoms b
          ON a.id < b.id
         AND a.type = b.type
         AND a.status = 'active' AND b.status = 'active'
         AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
         AND 1 - (a.embedding <=> b.embedding) > ${MERGE_SIM}
         AND a.affirmed_count >= b.affirmed_count
        LIMIT 100
      `);
      for (const r of candidates.rows as Array<{ keep_id: string; drop_id: string }>) {
        await tx.execute(sql`
          UPDATE memory_atoms SET
            affirmed_count = (SELECT affirmed_count FROM memory_atoms WHERE id = ${r.keep_id}) +
                             (SELECT affirmed_count FROM memory_atoms WHERE id = ${r.drop_id}),
            source_ids = (SELECT source_ids FROM memory_atoms WHERE id = ${r.keep_id}) ||
                         (SELECT source_ids FROM memory_atoms WHERE id = ${r.drop_id}),
            updated_at = NOW()
          WHERE id = ${r.keep_id}
        `);
        await tx.execute(sql`
          UPDATE memory_atoms
          SET status = 'superseded', supersedes_id = ${r.keep_id}, invalid_at = NOW(), updated_at = NOW()
          WHERE id = ${r.drop_id}
        `);
        merged++;
      }
    });
  }
  return { merged };
}
