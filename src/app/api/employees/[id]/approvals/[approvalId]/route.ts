import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { irreversibleApprovals, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

export async function POST(req: Request, ctx: { params: Promise<{ id: string; approvalId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const { approvalId } = await ctx.params;
  const { decision } = await req.json() as { decision: 'approved' | 'rejected' };
  if (!['approved', 'rejected'].includes(decision)) {
    return Response.json({ error: 'invalid_decision' }, { status: 400 });
  }

  await withTenant(me.orgId, (tx) =>
    tx.update(irreversibleApprovals).set({
      status: decision,
      decidedByUserId: session.user!.id!,
      decidedAt: new Date(),
    }).where(eq(irreversibleApprovals.id, approvalId)),
  );
  return Response.json({ ok: true });
}
