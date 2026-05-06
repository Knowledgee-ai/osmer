import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, memorySnapshots, organizations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

/**
 * GET /api/memory/map
 *
 * Returns the latest Memory Map snapshot for the user's org. If
 * `memoryMapAnonymous` is set on the org, contributor labels are
 * replaced with "Contributor" before returning.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const [snap] = await withTenant(me.orgId, (tx) =>
    tx.select().from(memorySnapshots).where(eq(memorySnapshots.orgId, me.orgId!)).orderBy(desc(memorySnapshots.computedAt)).limit(1),
  );
  if (!snap) return Response.json({ error: 'no_snapshot', message: 'Memory Map will populate after the next daily cron, or run /api/cron/memory-map.' }, { status: 404 });

  const [org] = await db.select().from(organizations).where(eq(organizations.id, me.orgId)).limit(1);
  const anon = ((org?.settings ?? {}) as Record<string, unknown>).memoryMapAnonymous === true;

  let nodes = snap.nodes as Array<{ id: string; kind: string; label: string; size: number; meta: Record<string, unknown> }>;
  if (anon) {
    nodes = nodes.map((n) => (n.kind === 'contributor' ? { ...n, label: 'Contributor' } : n));
  }

  return Response.json({
    snapshot: {
      orgId: snap.orgId,
      computedAt: snap.computedAt,
      nodes,
      edges: snap.edges,
      contributorWeights: anon ? [] : snap.contributorWeights,
      topicClusters: snap.topicClusters,
    },
    anonymous: anon,
  });
}
