import { streamText, type ModelMessage } from 'ai';
import { getLanguageModel, getLanguageModelWithKeys, estimateCost } from '@/lib/ai/router';
import { getModel } from '@/lib/ai/models';
import { auth } from '@/lib/auth';
import { searchKnowledgeByVector } from '@/lib/knowledge/db-store';
import { db } from '@/lib/db';
import { modelUsage } from '@/lib/db/schema';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();

  // Read BYOK API keys from header
  const apiKeysHeader = req.headers.get('x-api-keys');
  let byokKeys: Record<string, string> | undefined;
  if (apiKeysHeader) {
    try {
      byokKeys = JSON.parse(atob(apiKeysHeader));
    } catch {}
  }

  const body = await req.json();
  const { modelId, conversationId, knowledgeContext: clientContext, knowledgeMode } = body as {
    modelId: string;
    conversationId: string | null;
    knowledgeContext?: string[];
    knowledgeMode?: string;
  };

  const isAskCompany = knowledgeMode === "company";

  const rawMessages: Array<{ role: string; parts?: Array<{ type: string; text?: string }>; content?: string }> = body.messages || [];

  const modelMessages: ModelMessage[] = rawMessages.map((msg) => {
    const content = msg.content || msg.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '';
    return {
      role: msg.role as 'user' | 'assistant' | 'system',
      content,
    };
  });

  // Server-side semantic knowledge search
  let knowledgeContext = clientContext;
  if (session?.user?.id && !knowledgeContext) {
    const lastUserMessage = modelMessages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      try {
        const results = await searchKnowledgeByVector(
          lastUserMessage.content as string,
          session.user.id,
          8
        );
        if (results.length > 0) {
          knowledgeContext = results.map(r => r.content);
        }
      } catch {
        // Knowledge search is best-effort
      }
    }
  }

  const languageModel = byokKeys
    ? getLanguageModelWithKeys(modelId, byokKeys)
    : getLanguageModel(modelId);

  const systemPrompt = buildSystemPrompt(modelId, knowledgeContext, isAskCompany);

  const result = streamText({
    model: languageModel,
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ usage }) => {
      if (usage && session?.user?.id) {
        const u = usage as unknown as Record<string, number>;
        const tokensIn = u.inputTokens || u.promptTokens || 0;
        const tokensOut = u.outputTokens || u.completionTokens || 0;
        const cost = estimateCost(modelId, tokensIn, tokensOut);

        // Persist to model_usage table
        db.insert(modelUsage)
          .values({
            userId: session.user.id,
            model: modelId,
            tokensIn,
            tokensOut,
            cost,
          })
          .catch(() => {}); // Best-effort
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

function buildSystemPrompt(modelId: string, knowledgeContext?: string[], isAskCompany?: boolean): string {
  const model = getModel(modelId);
  const modelName = model?.name || modelId;

  // "Ask the Company" mode — answer ONLY from knowledge base
  if (isAskCompany && knowledgeContext && knowledgeContext.length > 0) {
    return `You are the "Ask the Company" assistant in Knowledge HQ. You answer questions ONLY using the organizational knowledge base provided below.

CRITICAL RULES:
1. ONLY answer using the knowledge provided below. Do NOT use any external knowledge.
2. If the knowledge base doesn't contain enough information, say "This isn't in our knowledge base yet."
3. Cite sources using [1], [2], etc. numbers matching the knowledge items.
4. Be concise and direct.
5. Never fabricate or guess information not in the knowledge base.

## Organizational Knowledge Base:
${knowledgeContext.map((k, i) => `[${i + 1}] ${k}`).join('\n')}`;
  }

  if (isAskCompany) {
    return `You are the "Ask the Company" assistant. The knowledge base is currently empty. Tell the user to chat normally first to build up the knowledge base, then switch to "Ask Company" mode to query it.`;
  }

  let prompt = `You are a helpful AI assistant powered by ${modelName}, accessed through Knowledge HQ, a multi-model AI platform with organizational memory.

Be concise, accurate, and helpful. If you're unsure about something, say so rather than guessing.`;

  if (knowledgeContext && knowledgeContext.length > 0) {
    prompt += `

## Organizational Knowledge Context

The following knowledge has been extracted from previous conversations and is relevant to the current discussion. Use this context to provide more informed responses:

${knowledgeContext.map((k, i) => `${i + 1}. ${k}`).join('\n')}

Use this context naturally — don't explicitly mention the knowledge base unless the user asks about it.`;
  }

  return prompt;
}
