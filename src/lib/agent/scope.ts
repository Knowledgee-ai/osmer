import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTenant } from '@/lib/db/tenant';
import type { MemoryScope } from './types';

/**
 * Resolve a per-employee MemoryScope to a concrete chunk-id allowlist.
 * Returns null when scope is 'org' — meaning unrestricted within
 * tenant. The runtime uses this to filter retrieve() results
 * post-hoc when scope is narrower than org.
 *
 * For M4 first cut, the runtime's memory.query tool falls through to
 * retrieve() with org scope; downstream filtering happens here.
 */
export async function resolveScopeChunkIds(orgId: string, scope: MemoryScope): Promise<string[] | null> {
  if (scope.kind === 'org') return null;
  return withTenant(orgId, async (tx) => {
    if (scope.kind === 'topics') {
      const r = await tx.execute(sql`
        SELECT c.id FROM source_chunks c
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(c.meta->'topics') AS t
          WHERE t = ANY(${scope.topics})
        )
      `);
      return (r.rows as Array<{ id: string }>).map((row) => row.id);
    }
    if (scope.kind === 'sources') {
      const r = await tx.execute(sql`
        SELECT id FROM source_chunks WHERE source_id = ANY(${scope.sourceIds}::uuid[])
      `);
      return (r.rows as Array<{ id: string }>).map((row) => row.id);
    }
    if (scope.kind === 'team') {
      const r = await tx.execute(sql`
        SELECT c.id FROM source_chunks c
        JOIN sources s ON s.id = c.source_id
        WHERE s.owner_user_id IN (SELECT user_id FROM team_members WHERE team_id = ${scope.teamId})
      `);
      return (r.rows as Array<{ id: string }>).map((row) => row.id);
    }
    return [];
  });
}
