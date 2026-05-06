import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, organizations } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * POST /api/admin/memory-map/anonymous
 *
 * Body: { anonymous: boolean }
 *
 * Toggles the org's `memoryMapAnonymous` setting. When true, the
 * Memory Map APIs strip contributor names + leaderboards. Owner /
 * admin only.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const [me] = await db.select({ orgId: users.orgId, role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });
  if (me.role !== 'admin' && me.role !== 'owner') {
    return Response.json({ error: 'forbidden', message: 'Owner or admin role required.' }, { status: 403 });
  }

  const { anonymous } = await req.json() as { anonymous: boolean };
  if (typeof anonymous !== 'boolean') {
    return Response.json({ error: 'anonymous must be a boolean' }, { status: 400 });
  }

  await db.execute(sql`
    UPDATE organizations
    SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('memoryMapAnonymous', ${anonymous}::boolean)
    WHERE id = ${me.orgId}
  `);
  return Response.json({ ok: true, anonymous });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });
  const [org] = await db.select().from(organizations).where(eq(organizations.id, me.orgId)).limit(1);
  const anon = ((org?.settings ?? {}) as Record<string, unknown>).memoryMapAnonymous === true;
  return Response.json({ anonymous: anon });
}
