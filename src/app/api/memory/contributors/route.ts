import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, memorySnapshots, organizations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const [snap] = await withTenant(me.orgId, (tx) =>
    tx.select().from(memorySnapshots).where(eq(memorySnapshots.orgId, me.orgId!)).orderBy(desc(memorySnapshots.computedAt)).limit(1),
  );
  if (!snap) return Response.json({ contributors: [] });

  const [org] = await db.select().from(organizations).where(eq(organizations.id, me.orgId)).limit(1);
  const anon = ((org?.settings ?? {}) as Record<string, unknown>).memoryMapAnonymous === true;
  if (anon) return Response.json({ contributors: [], anonymous: true });

  return Response.json({ contributors: snap.contributorWeights, anonymous: false });
}
