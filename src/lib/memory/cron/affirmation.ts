import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTenant } from '@/lib/db/tenant';
import { organizations } from '@/lib/db/schema';

/**
 * Daily: increment affirmed_count + last_affirmed for atoms whose
 * source chunks were touched in the past 24h. A cheap proxy for
 * "this knowledge is still being discussed."
 */
export async function runAffirmation() {
  const orgs = await db.select({ id: organizations.id }).from(organizations);
  let total = 0;
  for (const o of orgs) {
    const r = await withTenant(o.id, async (tx) => {
      return tx.execute(sql`
        UPDATE memory_atoms a
        SET affirmed_count = a.affirmed_count + 1,
            last_affirmed  = NOW(),
            confidence     = LEAST(a.confidence + 0.02, 1.0),
            updated_at     = NOW()
        WHERE a.status = 'active'
          AND EXISTS (
            SELECT 1 FROM source_chunks c
            WHERE c.id::text IN (SELECT jsonb_array_elements_text(a.source_ids))
              AND c.created_at >= NOW() - INTERVAL '24 hours'
          )
        RETURNING a.id
      `);
    });
    total += r.rows.length;
  }
  return { affirmed: total };
}
