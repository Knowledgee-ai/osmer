import { streamText } from 'ai';
import { auth } from '@/lib/auth';
import { getLanguageModel } from '@/lib/ai/router';
import { searchKnowledgeByVector } from '@/lib/knowledge/db-store';

export const maxDuration = 30;

/**
 * POST /api/knowledge/ask
 *
 * "Ask the Company" mode — answers ONLY from the knowledge base.
 * Zero hallucination, full citations.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question, modelId } = await req.json() as {
    question: string;
    modelId: string;
  };

  // Search for relevant knowledge
  const results = await searchKnowledgeByVector(question, session.user.id, 15);

  if (results.length === 0) {
    return Response.json({
      answer: "No relevant knowledge found in the knowledge base. Try chatting about this topic first to build up your organizational knowledge.",
      sources: [],
    });
  }

  // Format knowledge for the prompt
  const knowledgeBlock = results
    .map((r, i) => `[${i + 1}] (${r.type}, ${(r.confidence * 100).toFixed(0)}% confidence): ${r.content}`)
    .join('\n');

  const model = getLanguageModel(modelId);

  const result = streamText({
    model,
    system: `You are a knowledge base assistant for the "Ask the Company" feature in Knowledgee.

CRITICAL RULES:
1. You must ONLY answer using the knowledge provided below. Do NOT use any other knowledge.
2. If the knowledge base doesn't contain enough information to answer, say so clearly.
3. Cite your sources using [1], [2], etc. references.
4. Be concise and direct.
5. Never fabricate or guess information not in the knowledge base.

## Knowledge Base:
${knowledgeBlock}`,
    messages: [{ role: 'user', content: question }],
  });

  return result.toUIMessageStreamResponse();
}
