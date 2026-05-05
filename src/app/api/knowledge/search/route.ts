import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { retrieve } from '@/lib/memory/retrieve';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ atoms: [] });

  const { query, limit = 8 } = await req.json() as { query: string; limit?: number };
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ atoms: [] });

  const results = await retrieve({
    query,
    scope: { userId: session.user.id, teamIds: [], orgId: me.orgId, includeOrg: true },
    topN: limit,
  });

  return Response.json({
    atoms: results.map((r) => ({
      id: r.chunkId,
      sourceId: r.sourceId,
      content: r.content,
      similarity: r.finalScore,
    })),
  });
}
