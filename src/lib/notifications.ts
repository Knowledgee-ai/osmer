import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

type NotificationType =
  | 'knowledge.shared'
  | 'team.invite'
  | 'knowledge.conflict'
  | 'knowledge.stale'
  | 'team.member_joined';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  link?: string
) {
  try {
    await db.execute(
      sql`INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (${userId}, ${type}, ${title}, ${body || null}, ${link || null})`
    );
  } catch {
    // Best-effort
  }
}
