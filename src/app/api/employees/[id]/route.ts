import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { employees, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

async function userOrg(userId: string): Promise<string | null> {
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, userId)).limit(1);
  return me?.orgId ?? null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const orgId = await userOrg(session.user.id);
  if (!orgId) return Response.json({ error: 'no_org' }, { status: 400 });
  const { id } = await ctx.params;
  const [emp] = await withTenant(orgId, (tx) =>
    tx.select().from(employees).where(and(eq(employees.id, id), eq(employees.orgId, orgId))),
  );
  if (!emp) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ employee: emp });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const orgId = await userOrg(session.user.id);
  if (!orgId) return Response.json({ error: 'no_org' }, { status: 400 });
  const { id } = await ctx.params;

  const body = await req.json() as Partial<{
    name: string;
    description: string;
    inputs: unknown[];
    toolbelt: string[];
    exampleSourceIds: string[];
    memoryScope: unknown;
  }>;
  delete (body as Record<string, unknown>).version;
  delete (body as Record<string, unknown>).id;

  await withTenant(orgId, (tx) =>
    tx.update(employees).set({ ...body, updatedAt: new Date() }).where(and(eq(employees.id, id), eq(employees.orgId, orgId))),
  );
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const orgId = await userOrg(session.user.id);
  if (!orgId) return Response.json({ error: 'no_org' }, { status: 400 });
  const { id } = await ctx.params;
  await withTenant(orgId, (tx) =>
    tx.update(employees).set({ status: 'archived', updatedAt: new Date() }).where(and(eq(employees.id, id), eq(employees.orgId, orgId))),
  );
  return Response.json({ ok: true });
}
