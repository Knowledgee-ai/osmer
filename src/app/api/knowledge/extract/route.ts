import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { extractEntitiesForSource } from '@/lib/memory/entities';
import { projectAtoms } from '@/lib/memory/projection';
import { logAudit } from '@/lib/audit';

export const maxDuration = 120;

/**
 * POST /api/knowledge/extract
 *
 * Body: { sourceId: string }  (legacy callers may also send conversationId)
 *
 * Runs entity NER over the source's chunks, then projects new atoms
 * across the user's recent chunks. Idempotent within reason — running
 * it twice for the same source produces no extra entities (dedup) and
 * affirms existing atoms.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { sourceId?: string; conversationId?: string };
  const sourceId = body.sourceId ?? body.conversationId;
  if (!sourceId) return Response.json({ error: 'Missing sourceId' }, { status: 400 });

  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'No org' }, { status: 400 });

  const entities = await extractEntitiesForSource(sourceId, me.orgId);
  const projection = await projectAtoms(me.orgId, session.user.id);

  logAudit(session.user.id, 'knowledge.extract', 'knowledge', sourceId, { entities, projection });

  return Response.json({ entities, projection });
}
