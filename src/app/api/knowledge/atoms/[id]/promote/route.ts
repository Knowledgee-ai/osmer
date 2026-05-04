import { requireAdmin } from '@/lib/auth-admin';
import { promoteKnowledgeToTeam } from '@/lib/knowledge/db-store';
import { db } from '@/lib/db';
import { knowledgeAtoms, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/knowledge/atoms/[id]/promote — admin-only: promote atom to team scope
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;
  const { ctx } = guard;
  if (!ctx.orgId) return Response.json({ error: "No org context" }, { status: 400 });

  const { id: atomId } = await params;
  const { teamId } = await req.json() as { teamId: string };

  if (!teamId) {
    return Response.json({ error: "teamId is required" }, { status: 400 });
  }

  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.orgId)))
    .limit(1);
  if (!team) return Response.json({ error: "Team not in your org" }, { status: 404 });

  const [atom] = await db
    .select({ id: knowledgeAtoms.id, orgId: knowledgeAtoms.orgId, sourceUserId: knowledgeAtoms.sourceUserId })
    .from(knowledgeAtoms)
    .where(eq(knowledgeAtoms.id, atomId))
    .limit(1);
  if (!atom || atom.orgId !== ctx.orgId) {
    return Response.json({ error: "Atom not found" }, { status: 404 });
  }

  await promoteKnowledgeToTeam(atomId, teamId, atom.sourceUserId ?? ctx.userId);

  return Response.json({ ok: true });
}
