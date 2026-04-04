import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/audit — view audit trail
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
  const offset = Number(url.searchParams.get('offset') || 0);

  const result = await db.execute(sql`
    SELECT id, action, resource_type, resource_id, details, created_at
    FROM audit_log
    WHERE user_id = ${session.user.id}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as total FROM audit_log WHERE user_id = ${session.user.id}
  `);

  return Response.json({
    events: result.rows,
    total: Number((countResult.rows[0] as { total: string }).total),
    limit,
    offset,
  });
}
