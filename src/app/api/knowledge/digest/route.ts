import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { generateText } from 'ai';
import { getLanguageModel } from '@/lib/ai/router';

export const maxDuration = 30;

// GET /api/knowledge/digest — generate weekly knowledge digest
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get this week's data
  const [newAtoms, topTopics, conflicts, staleAtoms, conversationCount] = await Promise.all([
    db.execute(sql`
      SELECT type, content, confidence, created_at
      FROM knowledge_atoms
      WHERE scope_id = ${userId} AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT topic, COUNT(*) as count
      FROM knowledge_atoms, jsonb_array_elements_text(topics) as topic
      WHERE scope_id = ${userId} AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY topic ORDER BY count DESC LIMIT 5
    `),
    db.execute(sql`
      SELECT COUNT(*) as count FROM knowledge_conflicts kc
      JOIN knowledge_atoms ka ON kc.atom_a_id = ka.id
      WHERE ka.scope_id = ${userId} AND kc.status = 'open'
    `),
    db.execute(sql`
      SELECT COUNT(*) as count FROM knowledge_atoms
      WHERE scope_id = ${userId} AND status = 'stale'
    `),
    db.execute(sql`
      SELECT COUNT(*) as count FROM conversations
      WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '7 days'
    `),
  ]);

  const atoms = newAtoms.rows as Array<{ type: string; content: string; confidence: number; created_at: string }>;
  const topics = topTopics.rows as Array<{ topic: string; count: string }>;
  const conflictCount = Number((conflicts.rows[0] as { count: string }).count);
  const staleCount = Number((staleAtoms.rows[0] as { count: string }).count);
  const convCount = Number((conversationCount.rows[0] as { count: string }).count);

  if (atoms.length === 0) {
    return Response.json({
      digest: {
        period: "Last 7 days",
        summary: "No new knowledge captured this week. Start chatting to build your knowledge base.",
        newAtomsCount: 0,
        conversationCount: convCount,
        topTopics: [],
        conflicts: 0,
        staleAtoms: 0,
        highlights: [],
      },
    });
  }

  // Generate a natural language summary using AI
  const extractionModel = process.env.EXTRACTION_MODEL || 'anthropic/claude-haiku-4-5-20251001';
  const model = getLanguageModel(extractionModel);

  let aiSummary = "";
  try {
    const atomList = atoms.slice(0, 10).map(a => `[${a.type}] ${a.content}`).join('\n');
    const result = await generateText({
      model,
      prompt: `Write a concise 2-3 sentence weekly digest summary for a knowledge management tool. This week:
- ${atoms.length} new knowledge atoms captured
- ${convCount} conversations
- Top topics: ${topics.map(t => t.topic).join(', ') || 'none'}
- ${conflictCount} unresolved conflicts
- ${staleCount} stale atoms

Recent knowledge:
${atomList}

Write a friendly, informative summary highlighting the most interesting knowledge captured.`,
      maxOutputTokens: 100,
    });
    aiSummary = result.text.trim();
  } catch {
    aiSummary = `${atoms.length} new knowledge atoms captured from ${convCount} conversations this week.`;
  }

  return Response.json({
    digest: {
      period: "Last 7 days",
      summary: aiSummary,
      newAtomsCount: atoms.length,
      conversationCount: convCount,
      topTopics: topics.map(t => ({ topic: t.topic, count: Number(t.count) })),
      conflicts: conflictCount,
      staleAtoms: staleCount,
      highlights: atoms.slice(0, 5).map(a => ({
        type: a.type,
        content: a.content,
        date: a.created_at,
      })),
    },
  });
}
