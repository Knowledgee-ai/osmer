import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { modelUsage, conversations, messages, knowledgeAtoms } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// GET /api/analytics — usage analytics for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [
    totalSpendResult,
    spendByModelResult,
    conversationCountResult,
    messageCountResult,
    knowledgeGrowthResult,
    recentActivityResult,
  ] = await Promise.all([
    // Total spend
    db.execute(sql`
      SELECT COALESCE(SUM(cost), 0) as total_cost,
             COALESCE(SUM(tokens_in), 0) as total_tokens_in,
             COALESCE(SUM(tokens_out), 0) as total_tokens_out
      FROM model_usage WHERE user_id = ${userId}
    `),

    // Spend by model
    db.execute(sql`
      SELECT model, SUM(cost) as total_cost, COUNT(*) as request_count,
             SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out
      FROM model_usage WHERE user_id = ${userId}
      GROUP BY model ORDER BY total_cost DESC LIMIT 10
    `),

    // Conversation count
    db.execute(sql`
      SELECT COUNT(*) as count FROM conversations WHERE user_id = ${userId}
    `),

    // Message count
    db.execute(sql`
      SELECT COUNT(*) as count FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = ${userId}
    `),

    // Knowledge growth (atoms per day, last 7 days)
    db.execute(sql`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM knowledge_atoms WHERE scope_id = ${userId}
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at) ORDER BY day
    `),

    // Recent activity (messages per day, last 7 days)
    db.execute(sql`
      SELECT DATE(m.created_at) as day, COUNT(*) as count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = ${userId}
        AND m.created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(m.created_at) ORDER BY day
    `),
  ]);

  const totals = totalSpendResult.rows[0] as { total_cost: number; total_tokens_in: number; total_tokens_out: number };

  return Response.json({
    analytics: {
      totalCost: Number(totals.total_cost || 0),
      totalTokensIn: Number(totals.total_tokens_in || 0),
      totalTokensOut: Number(totals.total_tokens_out || 0),
      conversationCount: Number((conversationCountResult.rows[0] as { count: string }).count),
      messageCount: Number((messageCountResult.rows[0] as { count: string }).count),
      spendByModel: (spendByModelResult.rows as Array<{
        model: string;
        total_cost: number;
        request_count: string;
        tokens_in: number;
        tokens_out: number;
      }>).map((r) => ({
        model: r.model,
        cost: Number(r.total_cost),
        requests: Number(r.request_count),
        tokensIn: Number(r.tokens_in),
        tokensOut: Number(r.tokens_out),
      })),
      knowledgeGrowth: (knowledgeGrowthResult.rows as Array<{ day: string; count: string }>).map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
      recentActivity: (recentActivityResult.rows as Array<{ day: string; count: string }>).map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
    },
  });
}
