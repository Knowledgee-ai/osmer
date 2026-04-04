import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '@/lib/ai/router';

const KnowledgeAtomSchema = z.object({
  type: z.enum(['fact', 'decision', 'preference', 'solution', 'relationship', 'process', 'context']),
  content: z.string().describe('A clear, standalone statement of knowledge'),
  confidence: z.number().describe('Confidence score between 0 and 1'),
  topics: z.array(z.string()).describe('Topic tags for this knowledge'),
  entities: z.array(z.string()).describe('People, systems, technologies mentioned'),
});

const ExtractionResultSchema = z.object({
  atoms: z.array(KnowledgeAtomSchema).describe('Extracted knowledge atoms'),
});

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, conversationId } = await req.json() as {
    messages: Array<{ role: string; content: string }>;
    conversationId: string;
  };

  // Only extract from conversations with enough substance
  if (messages.length < 2) {
    return Response.json({ atoms: [] });
  }

  // Use a cheap, fast model for extraction
  const extractionModelId = process.env.EXTRACTION_MODEL || 'anthropic/claude-haiku-4-5-20251001';
  const model = getLanguageModel(extractionModelId);

  // Format the conversation for the extraction prompt
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  try {
    const result = await generateObject({
      model,
      schema: ExtractionResultSchema,
      prompt: `You are a knowledge extraction engine for an organizational knowledge management system.

Analyze this conversation and extract discrete, reusable knowledge atoms. Each atom should be a standalone piece of knowledge that would be useful in future conversations.

Types of knowledge to extract:
- fact: Verifiable statements ("Our API rate limit is 1000 req/min")
- decision: Choices made with rationale ("We decided to use PostgreSQL because...")
- preference: Personal or team preferences ("Prefers TypeScript over JavaScript")
- solution: Actionable fixes ("To fix CORS, add the origin to nginx.conf")
- relationship: How things connect ("The billing service depends on Stripe")
- process: How things work ("Deploy process: PR → CI → staging → prod")
- context: Current state ("We're migrating from AWS to GCP")

Rules:
- Only extract REUSABLE knowledge, not transient task details
- Each atom must be a clear, standalone statement
- Prefer precision over volume — 2 high-quality atoms > 10 mediocre ones
- Set confidence based on how clearly stated the knowledge is
- Skip: small talk, obvious/common knowledge, speculation
- Do NOT extract knowledge that's only relevant to this specific conversation

Conversation:
${conversationText}`,
    });

    // Add metadata to each atom
    const atoms = result.object.atoms.map((atom) => ({
      ...atom,
      id: crypto.randomUUID(),
      scope: 'personal' as const,
      sourceConversationId: conversationId,
      extractedBy: extractionModelId,
      createdAt: new Date().toISOString(),
      lastAffirmed: new Date().toISOString(),
      affirmedCount: 1,
    }));

    return Response.json({ atoms });
  } catch (error) {
    console.error('Knowledge extraction failed:', error instanceof Error ? error.message : error);
    console.error('Full error:', error);
    return Response.json({ atoms: [], error: String(error instanceof Error ? error.message : error) });
  }
}
