import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

// POST /api/mentions — process @mentions in a message
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, conversationId } = await req.json() as {
    message: string;
    conversationId: string;
  };

  // Extract @mentions from message using a simple word-boundary pattern
  const words = message.split(/\s+/);
  const mentions = words
    .filter((w) => w.startsWith('@') && w.length > 1)
    .map((w) => w.slice(1).replace(/[^a-zA-Z0-9._@-]/g, ''));

  if (mentions.length === 0) {
    return Response.json({ mentions: [] });
  }

  // Find users matching the mentions (by name or email prefix)
  const resolved = [];
  for (const mention of mentions) {
    const lowerMention = mention.toLowerCase();
    const users = await db.execute(
      sql`SELECT id, name, email FROM users
        WHERE LOWER(name) LIKE ${lowerMention + '%'}
        OR LOWER(split_part(email, '@', 1)) = ${lowerMention}
        LIMIT 1`
    );

    if (users.rows.length > 0) {
      const user = users.rows[0] as { id: string; name: string; email: string };
      resolved.push({ mention, userId: user.id, name: user.name });

      // Send notification
      createNotification(
        user.id,
        'knowledge.shared',
        session.user.name + ' mentioned you',
        'In a conversation: "' + message.substring(0, 80) + '..."',
        '/chat'
      );
    }
  }

  return Response.json({ mentions: resolved });
}
