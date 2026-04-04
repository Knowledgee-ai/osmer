import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/models/suggest — suggest best model based on usage patterns
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ suggestions: [] });
  }

  const url = new URL(req.url);
  const taskType = url.searchParams.get('task') || 'general';

  // Analyze usage patterns: which models are used most, avg cost, etc.
  const usageData = await db.execute(sql`
    SELECT model,
      COUNT(*) as request_count,
      AVG(cost) as avg_cost,
      SUM(tokens_out) as total_output_tokens
    FROM model_usage
    WHERE user_id = ${session.user.id}
    GROUP BY model
    ORDER BY request_count DESC
  `);

  const models = usageData.rows as Array<{
    model: string;
    request_count: string;
    avg_cost: number;
    total_output_tokens: number;
  }>;

  // Build suggestions based on task type
  const suggestions = [];

  // Most used model (trusted choice)
  if (models.length > 0) {
    suggestions.push({
      model: models[0].model,
      reason: `Most used — ${models[0].request_count} requests`,
      type: 'most-used',
    });
  }

  // Cheapest model
  const cheapest = [...models].sort((a, b) => (a.avg_cost || 0) - (b.avg_cost || 0))[0];
  if (cheapest && cheapest.model !== models[0]?.model) {
    suggestions.push({
      model: cheapest.model,
      reason: `Most cost-effective — avg $${Number(cheapest.avg_cost || 0).toFixed(5)}/req`,
      type: 'cheapest',
    });
  }

  // Task-based recommendations (heuristic)
  const taskModels: Record<string, { model: string; reason: string }> = {
    code: { model: 'anthropic/claude-sonnet-4-20250514', reason: 'Best for code generation and review' },
    writing: { model: 'openai/gpt-4o', reason: 'Strong creative and long-form writing' },
    analysis: { model: 'google/gemini-2.5-pro', reason: '1M context window for large documents' },
    quick: { model: 'anthropic/claude-haiku-4-5-20251001', reason: 'Fastest responses at lowest cost' },
    reasoning: { model: 'anthropic/claude-opus-4-6', reason: 'Deepest reasoning and complex tasks' },
  };

  if (taskModels[taskType]) {
    suggestions.push({
      ...taskModels[taskType],
      type: 'task-optimized',
    });
  }

  return Response.json({ suggestions, taskType });
}
