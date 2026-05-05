import { generateText } from 'ai';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLanguageModel } from '@/lib/ai/router';
import { retrieve } from '@/lib/memory/retrieve';

export const maxDuration = 30;

/**
 * POST /api/knowledge/ask
 *
 * Grounded knowledge-base query. Returns a single answer with citation
 * sources, drawn from the verbatim store via hybrid retrieval.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { question, modelId } = await req.json() as {
    question: string;
    modelId?: string;
  };

  if (!question?.trim()) {
    return Response.json({ error: 'Missing question' }, { status: 400 });
  }

  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'No org' }, { status: 400 });

  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, session.user.id));
  const teamIds = userTeams.map((t) => t.teamId);

  const results = await retrieve({
    query: question,
    scope: { userId: session.user.id, teamIds, orgId: me.orgId, includeOrg: true },
    topN: 15,
  });

  if (results.length === 0) {
    return Response.json({
      answer: 'Nothing in the knowledge base touches on that yet. Discuss it in a chat to seed it.',
      sources: [],
    });
  }

  const knowledgeBlock = results
    .map((r, i) => `[${i + 1}] (score: ${r.finalScore.toFixed(3)}): ${r.content}`)
    .join('\n');

  const model = getLanguageModel(modelId || 'anthropic/claude-sonnet-4-6');

  const { text } = await generateText({
    model,
    system: `You answer strictly from the knowledge base provided below.

Rules:
1. Use only the knowledge supplied. Never use outside knowledge.
2. If the knowledge is insufficient, say so plainly.
3. Cite supporting items with [1], [2], etc.
4. Be concise and direct.

## Knowledge Base:
${knowledgeBlock}`,
    messages: [{ role: 'user', content: question }],
  });

  return Response.json({
    answer: text,
    sources: results.map((r, i) => ({
      n: i + 1,
      chunkId: r.chunkId,
      sourceId: r.sourceId,
      content: r.content,
      score: r.finalScore,
    })),
  });
}
