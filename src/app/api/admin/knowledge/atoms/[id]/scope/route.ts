import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { knowledgeAtoms, teams, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Scope = 'personal' | 'team' | 'organization';

// PATCH /api/admin/knowledge/atoms/[id]/scope — manually set an atom's scope
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;
  const { ctx } = guard;
  if (!ctx.orgId) {
    return Response.json({ error: "No org context" }, { status: 400 });
  }

  const { id: atomId } = await params;
  const { scope, scopeId } = await req.json() as { scope: Scope; scopeId?: string };

  // Resolve scopeId based on requested scope
  let resolvedScopeId: string;
  if (scope === 'organization') {
    resolvedScopeId = ctx.orgId;
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, ctx.orgId)).limit(1);
    if (!org) return Response.json({ error: "Org not found" }, { status: 404 });
  } else if (scope === 'team') {
    if (!scopeId) return Response.json({ error: "scopeId (teamId) required for team scope" }, { status: 400 });
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, scopeId), eq(teams.orgId, ctx.orgId)))
      .limit(1);
    if (!team) return Response.json({ error: "Team not in your org" }, { status: 404 });
    resolvedScopeId = scopeId;
  } else if (scope === 'personal') {
    if (!scopeId) return Response.json({ error: "scopeId (userId) required for personal scope" }, { status: 400 });
    resolvedScopeId = scopeId;
  } else {
    return Response.json({ error: "Invalid scope" }, { status: 400 });
  }

  const [atom] = await db
    .select({ id: knowledgeAtoms.id, orgId: knowledgeAtoms.orgId })
    .from(knowledgeAtoms)
    .where(eq(knowledgeAtoms.id, atomId))
    .limit(1);

  if (!atom || atom.orgId !== ctx.orgId) {
    return Response.json({ error: "Atom not found" }, { status: 404 });
  }

  await db
    .update(knowledgeAtoms)
    .set({ scope, scopeId: resolvedScopeId, updatedAt: new Date() })
    .where(eq(knowledgeAtoms.id, atomId));

  return Response.json({ ok: true, scope, scopeId: resolvedScopeId });
}
