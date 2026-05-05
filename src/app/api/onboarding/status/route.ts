import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, ingestionJobs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const { jobs, totalChunks } = await withTenant(me.orgId, async (tx) => {
    const j = await tx
      .select({
        id: ingestionJobs.id,
        kind: ingestionJobs.kind,
        filename: ingestionJobs.filename,
        status: ingestionJobs.status,
        chunkCount: ingestionJobs.chunkCount,
        errorMessage: ingestionJobs.errorMessage,
        meta: ingestionJobs.meta,
        updatedAt: ingestionJobs.updatedAt,
      })
      .from(ingestionJobs)
      .orderBy(sql`${ingestionJobs.createdAt} DESC`)
      .limit(20);
    const c = await tx.execute(sql`SELECT COUNT(*) AS c FROM source_chunks`);
    return { jobs: j, totalChunks: Number((c.rows[0] as { c: number }).c) };
  });

  return Response.json({ jobs, totalChunks });
}
