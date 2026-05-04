import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// GET /api/admin/knowledge/atoms — list atoms across the org with provenance
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;
  const { ctx } = guard;

  if (!ctx.orgId) {
    return Response.json({ atoms: [] });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope"); // optional filter
  const status = url.searchParams.get("status") ?? "active";

  const scopeFilter = scope ? sql`AND ka.scope = ${scope}` : sql``;

  const rows = await db.execute(
    sql`SELECT ka.id, ka.type, ka.scope, ka.scope_id, ka.content, ka.confidence,
        ka.status, ka.topics, ka.created_at, ka.last_affirmed, ka.affirmed_count,
        ka.source_user_id, u.name as source_user_name,
        CASE
          WHEN ka.scope = 'team' THEN t.name
          WHEN ka.scope = 'organization' THEN o.name
          ELSE NULL
        END as scope_label
      FROM knowledge_atoms ka
      LEFT JOIN users u ON u.id = ka.source_user_id
      LEFT JOIN teams t ON ka.scope = 'team' AND t.id = ka.scope_id
      LEFT JOIN organizations o ON ka.scope = 'organization' AND o.id = ka.scope_id
      WHERE ka.org_id = ${ctx.orgId}
        AND ka.status = ${status}
        ${scopeFilter}
      ORDER BY ka.created_at DESC
      LIMIT 200`
  );

  return Response.json({ atoms: rows.rows });
}
