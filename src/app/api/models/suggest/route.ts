import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/models/suggest — suggest best model based on task + usage
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ suggestions: [] });
  }

  const url = new URL(req.url);
  const task = url.searchParams.get('task') || '';
  const message = url.searchParams.get('message') || '';

  // Analyze message content to detect task type
  const detectedTask = detectTaskType(message || task);

  // Get usage data
  const usageData = await db.execute(sql`
    SELECT model, COUNT(*) as request_count, AVG(cost) as avg_cost
    FROM model_usage WHERE user_id = ${session.user.id}
    GROUP BY model ORDER BY request_count DESC
  `);

  const models = usageData.rows as Array<{ model: string; request_count: string; avg_cost: number }>;

  const suggestions = [];

  // Task-based recommendation
  const taskModels: Record<string, { model: string; reason: string }> = {
    code: { model: 'qwen/qwen-3.6-max-preview', reason: 'Tops six coding benchmarks — best for code-on-knowledge tasks' },
    writing: { model: 'openai/gpt-5.5', reason: 'Strong long-form writing and creative output' },
    analysis: { model: 'google/gemini-3.1-pro', reason: '1M context + native multimodal — ideal for large document analysis' },
    math: { model: 'openai/gpt-5.5-pro', reason: 'Deep-reasoning variant for the hardest analytical work' },
    quick: { model: 'google/gemini-3-flash', reason: 'Cost-efficient frontier — fastest at lowest cost' },
    general: { model: 'anthropic/claude-sonnet-4-6', reason: 'Agentic workhorse — 1M context, strong tool use' },
  };

  if (taskModels[detectedTask]) {
    suggestions.push({ ...taskModels[detectedTask], type: 'smart-suggestion', task: detectedTask });
  }

  // Most used (if different from suggestion)
  if (models.length > 0 && models[0].model !== suggestions[0]?.model) {
    suggestions.push({
      model: models[0].model,
      reason: 'Your most used — ' + models[0].request_count + ' requests',
      type: 'most-used',
    });
  }

  // Budget option
  const cheapest = [...models].sort((a, b) => (a.avg_cost || 0) - (b.avg_cost || 0))[0];
  if (cheapest && !suggestions.some(s => s.model === cheapest.model)) {
    suggestions.push({
      model: cheapest.model,
      reason: 'Most cost-effective — avg $' + Number(cheapest.avg_cost || 0).toFixed(5) + '/req',
      type: 'budget',
    });
  }

  return Response.json({ suggestions, detectedTask });
}

function detectTaskType(text: string): string {
  const lower = text.toLowerCase();

  // Code detection
  if (/\b(code|function|class|api|bug|debug|implement|refactor|typescript|python|javascript|react|sql|regex)\b/.test(lower)) {
    return 'code';
  }

  // Writing detection
  if (/\b(write|draft|essay|blog|article|email|copy|story|creative|rewrite)\b/.test(lower)) {
    return 'writing';
  }

  // Analysis detection
  if (/\b(analyze|compare|evaluate|review|assess|summarize|summary|report)\b/.test(lower)) {
    return 'analysis';
  }

  // Math/reasoning detection
  if (/\b(calculate|math|equation|proof|logic|theorem|solve|formula)\b/.test(lower)) {
    return 'math';
  }

  // Quick tasks
  if (text.length < 50) {
    return 'quick';
  }

  return 'general';
}
