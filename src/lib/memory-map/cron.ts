import { db } from '@/lib/db';
import { organizations, memorySnapshots } from '@/lib/db/schema';
import { withTenant } from '@/lib/db/tenant';
import { computeSnapshot } from './snapshot';

const TEST_SLUG_PREFIXES = [
  'cu-', 'ku-', 'ab-', 'eflow-', 't-', 'u-', 'r-', 'lme-', 'rls-',
  'sem-', 'lex-', 'pii-', 'cold-', 'g-', 'c-', 'ing-', 'e-',
];

/**
 * Daily: compute a Memory Map snapshot per non-test org and persist
 * to memory_snapshots. The 2D + 3D renderers read the most-recent
 * snapshot per org.
 */
export async function runMemoryMapSnapshot(): Promise<{ snapshots: number; skipped: number }> {
  const orgs = await db.select({ id: organizations.id, slug: organizations.slug }).from(organizations);
  const real = orgs.filter((o) => !TEST_SLUG_PREFIXES.some((p) => o.slug.startsWith(p)));

  let snapshots = 0;
  let skipped = 0;
  for (const o of real) {
    try {
      const snap = await computeSnapshot(o.id);
      await withTenant(o.id, (tx) =>
        tx.insert(memorySnapshots).values({
          orgId: o.id,
          nodes: snap.nodes,
          edges: snap.edges,
          contributorWeights: snap.contributorWeights,
          topicClusters: snap.topicClusters,
        }),
      );
      snapshots++;
    } catch (err) {
      console.error(`[memory-map] snapshot failed for org ${o.id}:`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }
  return { snapshots, skipped };
}
