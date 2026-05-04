import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { conversations, messages, knowledgeAtoms, users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

// GET /api/export — download all user data as JSON
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch all data in parallel
  const [userData, convData, knowledgeData] = await Promise.all([
    // User info
    db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
      .from(users).where(eq(users.id, userId)).limit(1),

    // Conversations with messages
    db.execute(sql`
      SELECT c.id, c.title, c.model_default, c.visibility, c.created_at, c.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id, 'role', m.role, 'content', m.content,
              'model_used', m.model_used, 'created_at', m.created_at
            ) ORDER BY m.created_at
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as messages
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `),

    // Knowledge atoms
    db.execute(sql`
      SELECT id, type, scope, content, confidence, status, topics, structured,
        decay_rate, created_at, last_affirmed, affirmed_count, extracted_by
      FROM knowledge_atoms
      WHERE scope_id = ${userId}
      ORDER BY created_at DESC
    `),
  ]);

  logAudit(userId, 'data.export', 'export', undefined, {
    conversations: convData.rows.length,
    knowledgeAtoms: knowledgeData.rows.length,
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    platform: "Osmer",
    version: "0.1.0",
    user: userData[0] || null,
    conversations: convData.rows,
    knowledgeAtoms: knowledgeData.rows,
    summary: {
      conversationCount: convData.rows.length,
      knowledgeAtomCount: knowledgeData.rows.length,
    },
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="osmer-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}
