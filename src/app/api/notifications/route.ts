import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/notifications — list notifications
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ notifications: [], unreadCount: 0 });
  }

  const result = await db.execute(sql`
    SELECT id, type, title, body, link, read, created_at
    FROM notifications
    WHERE user_id = ${session.user.id}
    ORDER BY created_at DESC
    LIMIT 20
  `);

  const unreadResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ${session.user.id} AND read = false
  `);

  return Response.json({
    notifications: result.rows,
    unreadCount: Number((unreadResult.rows[0] as { count: string }).count),
  });
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.execute(sql`
    UPDATE notifications SET read = true
    WHERE user_id = ${session.user.id} AND read = false
  `);

  return Response.json({ ok: true });
}
