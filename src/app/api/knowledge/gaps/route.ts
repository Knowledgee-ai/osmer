import { generateObject } from 'ai';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { knowledgeAtoms, conversations, messages } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { getLanguageModel } from '@/lib/ai/router';

export const maxDuration = 30;

const GapsSchema = z.object({
  gaps: z.array(z.object({
    topic: z.string().describe('The topic area that lacks knowledge'),
    description: z.string().describe('What knowledge is missing'),
    priority: z.enum(['high', 'medium', 'low']).describe('How important this gap is'),
  })),
});

// GET /api/knowledge/gaps — detect gaps in the knowledge base
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get existing knowledge topics
  const existingKnowledge = await db.execute(sql`
    SELECT content, type, topics
    FROM knowledge_atoms
    WHERE scope_id = ${userId} AND status = 'active'
    ORDER BY confidence DESC
    LIMIT 30
  `);

  // Get recent conversation topics (questions asked)
  const recentQuestions = await db.execute(sql`
    SELECT m.content
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.user_id = ${userId}
      AND m.role = 'user'
      AND m.created_at > NOW() - INTERVAL '30 days'
    ORDER BY m.created_at DESC
    LIMIT 20
  `);

  if (recentQuestions.rows.length === 0) {
    return Response.json({ gaps: [] });
  }

  const knowledgeSummary = (existingKnowledge.rows as Array<{ content: string; type: string }>)
    .map((k) => `[${k.type}] ${k.content}`)
    .join('\n');

  const questionsSummary = (recentQuestions.rows as Array<{ content: string }>)
    .map((q) => q.content.substring(0, 150))
    .join('\n');

  const extractionModel = process.env.EXTRACTION_MODEL || 'google/gemini-3-flash';
  const model = getLanguageModel(extractionModel);

  try {
    const result = await generateObject({
      model,
      schema: GapsSchema,
      prompt: `Analyze the difference between what this organization knows and what they've been asking about. Identify knowledge gaps — topics they ask about but don't have documented knowledge for.

## Existing Knowledge Base:
${knowledgeSummary || 'Empty — no knowledge captured yet.'}

## Recent Questions Asked:
${questionsSummary}

Identify 3-5 specific knowledge gaps. Focus on topics where questions were asked but no matching knowledge exists. Rate priority based on how frequently the topic comes up.`,
    });

    return Response.json({ gaps: result.object.gaps });
  } catch {
    return Response.json({ gaps: [] });
  }
}
