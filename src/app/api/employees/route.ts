import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { employees, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const list = await withTenant(me.orgId, async (tx) => {
    return tx.select().from(employees).where(eq(employees.status, 'active')).orderBy(desc(employees.createdAt));
  });
  return Response.json({ employees: list });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const body = await req.json() as {
    name: string;
    description: string;
    inputs?: unknown[];
    toolbelt?: string[];
    exampleSourceIds?: string[];
    memoryScope?: unknown;
  };
  if (!body.name?.trim() || !body.description?.trim()) {
    return Response.json({ error: 'name and description required' }, { status: 400 });
  }

  const [created] = await withTenant(me.orgId, async (tx) => {
    return tx.insert(employees).values({
      orgId: me.orgId!,
      ownerUserId: session.user!.id!,
      name: body.name.trim(),
      description: body.description.trim(),
      inputs: body.inputs ?? [],
      toolbelt: body.toolbelt ?? ['memory.query', 'web.search'],
      exampleSourceIds: body.exampleSourceIds ?? [],
      memoryScope: body.memoryScope ?? { kind: 'org' },
    }).returning();
  });
  return Response.json({ employee: created });
}
