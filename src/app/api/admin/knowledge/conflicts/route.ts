import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { knowledgeConflicts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

// GET /api/admin/knowledge/conflicts — list open conflicts in this org
export async function GET() {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;
  const { ctx } = guard;
  if (!ctx.orgId) return Response.json({ conflicts: [] });

  const rows = await db.execute(
    sql`SELECT kc.id, kc.status, kc.created_at,
        a.id as atom_a_id, a.content as atom_a_content, a.scope as atom_a_scope, a.confidence as atom_a_confidence,
        b.id as atom_b_id, b.content as atom_b_content, b.scope as atom_b_scope, b.confidence as atom_b_confidence
      FROM knowledge_conflicts kc
      JOIN knowledge_atoms a ON a.id = kc.atom_a_id
      JOIN knowledge_atoms b ON b.id = kc.atom_b_id
      WHERE kc.status = 'open'
        AND a.org_id = ${ctx.orgId}
      ORDER BY kc.created_at DESC
      LIMIT 100`
  );

  return Response.json({ conflicts: rows.rows });
}

// PATCH /api/admin/knowledge/conflicts?id=<conflictId> — resolve a conflict
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;
  const { ctx } = guard;

  const url = new URL(req.url);
  const conflictId = url.searchParams.get("id");
  if (!conflictId) return Response.json({ error: "Missing id" }, { status: 400 });

  await db
    .update(knowledgeConflicts)
    .set({ status: 'resolved', resolvedBy: ctx.userId, resolvedAt: new Date() })
    .where(eq(knowledgeConflicts.id, conflictId));

  return Response.json({ ok: true });
}
