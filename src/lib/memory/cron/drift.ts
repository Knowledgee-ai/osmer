import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTenant } from '@/lib/db/tenant';
import { organizations } from '@/lib/db/schema';

const DECAY_RATE_BY_TYPE: Record<string, number> = {
  fact: 0.4,
  decision: 0.2,
  preference: 0.3,
};

/**
 * Daily: apply soft confidence decay to atoms not affirmed in the
 * past week. Atoms that drop below 0.3 are marked stale.
 */
export async function runDrift() {
  const orgs = await db.select({ id: organizations.id }).from(organizations);
  let decayed = 0, stale = 0;
  for (const o of orgs) {
    await withTenant(o.id, async (tx) => {
      const decayResult = await tx.execute(sql`
        UPDATE memory_atoms
        SET confidence = confidence * EXP(
              - CASE type
                  WHEN 'fact'       THEN ${DECAY_RATE_BY_TYPE.fact}
                  WHEN 'decision'   THEN ${DECAY_RATE_BY_TYPE.decision}
                  ELSE                   ${DECAY_RATE_BY_TYPE.preference}
                END
              * EXTRACT(EPOCH FROM (NOW() - last_affirmed)) / (365.0 * 86400)
            ),
            updated_at = NOW()
        WHERE status = 'active'
          AND last_affirmed < NOW() - INTERVAL '7 days'
        RETURNING id
      `);
      decayed += decayResult.rows.length;

      const staleResult = await tx.execute(sql`
        UPDATE memory_atoms
        SET status = 'stale', updated_at = NOW()
        WHERE status = 'active'
          AND confidence < 0.3
        RETURNING id
      `);
      stale += staleResult.rows.length;
    });
  }
  return { decayed, stale };
}
