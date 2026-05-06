import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

/**
 * POST /api/devices/register
 *
 * Body: { expoPushToken: string, platform: 'ios' | 'android' }
 *
 * Idempotent on (expoPushToken). Stores the device under the user's
 * org so push notifications are tenant-scoped.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const { expoPushToken, platform } = await req.json() as { expoPushToken: string; platform: 'ios' | 'android' };
  if (!expoPushToken || !platform) return Response.json({ error: 'expoPushToken + platform required' }, { status: 400 });

  await withTenant(me.orgId, (tx) =>
    tx.insert(devices)
      .values({ userId: session.user!.id!, orgId: me.orgId!, expoPushToken, platform })
      .onConflictDoNothing(),
  );

  return Response.json({ ok: true });
}
