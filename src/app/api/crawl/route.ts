import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, ingestionJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';
import { crawlSite } from '@/lib/ingest/crawler';

export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const { url } = await req.json() as { url: string };
  if (!url || !url.startsWith('http')) return Response.json({ error: 'bad_url' }, { status: 400 });

  const [job] = await withTenant(me.orgId, async (tx) => {
    return tx.insert(ingestionJobs).values({
      orgId: me.orgId!,
      ownerUserId: session.user!.id!,
      kind: 'crawl',
      meta: { url },
      status: 'parsing',
    }).returning({ id: ingestionJobs.id });
  });

  try {
    const report = await crawlSite(me.orgId, session.user.id, url);
    await withTenant(me.orgId, (tx) => tx.update(ingestionJobs).set({
      status: 'complete',
      chunkCount: report.pagesCrawled,
      meta: { url, ...report },
      updatedAt: new Date(),
    }).where(eq(ingestionJobs.id, job.id)));
    return Response.json({ jobId: job.id, ...report });
  } catch (err) {
    await withTenant(me.orgId, (tx) => tx.update(ingestionJobs).set({
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
      updatedAt: new Date(),
    }).where(eq(ingestionJobs.id, job.id)));
    return Response.json({ jobId: job.id, error: String(err) }, { status: 500 });
  }
}
