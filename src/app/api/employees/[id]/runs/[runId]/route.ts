import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { employeeRuns, toolAudit, users } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; runId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });
  const { runId } = await ctx.params;

  const { run, audit } = await withTenant(me.orgId, async (tx) => {
    const [run] = await tx.select().from(employeeRuns).where(eq(employeeRuns.id, runId));
    const audit = await tx.select().from(toolAudit).where(eq(toolAudit.runId, runId)).orderBy(asc(toolAudit.createdAt));
    return { run, audit };
  });
  if (!run) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ run, audit });
}
