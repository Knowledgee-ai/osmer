import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and, ilike, sql, desc } from "drizzle-orm";

// POST /api/conversations/search — search across conversations by content
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ results: [] });
  }

  const { query } = await req.json() as { query: string };

  if (!query || query.length < 2) {
    return Response.json({ results: [] });
  }

  // Search in message content and conversation titles
  const results = await db.execute(sql`
    SELECT DISTINCT ON (c.id)
      c.id,
      c.title,
      c.updated_at,
      m.content as match_content,
      m.role as match_role
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = ${session.user.id}
      AND (
        m.content ILIKE ${'%' + query + '%'}
        OR c.title ILIKE ${'%' + query + '%'}
      )
    ORDER BY c.id, c.updated_at DESC
    LIMIT 20
  `);

  return Response.json({
    results: (results.rows as Array<{
      id: string;
      title: string;
      updated_at: string;
      match_content: string;
      match_role: string;
    }>).map((r) => ({
      conversationId: r.id,
      title: r.title,
      matchPreview: r.match_content.length > 100
        ? r.match_content.substring(0, 100) + "..."
        : r.match_content,
      matchRole: r.match_role,
      updatedAt: r.updated_at,
    })),
  });
}
