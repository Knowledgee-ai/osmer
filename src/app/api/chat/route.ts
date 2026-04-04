import { streamText, type ModelMessage } from 'ai';
import { getLanguageModel, getLanguageModelWithKeys } from '@/lib/ai/router';
import { getModel } from '@/lib/ai/models';
import { auth } from '@/lib/auth';
import { searchKnowledgeByVector } from '@/lib/knowledge/db-store';

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
  const { modelId, conversationId, knowledgeContext: clientContext } = body as {
    modelId: string;
    conversationId: string | null;
    knowledgeContext?: string[];
  };

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

  const systemPrompt = buildSystemPrompt(modelId, knowledgeContext);

  const result = streamText({
    model: languageModel,
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ usage }) => {
      if (usage) {
        console.log(`[${modelId}] tokens: ${JSON.stringify(usage)}`);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

function buildSystemPrompt(modelId: string, knowledgeContext?: string[]): string {
  const model = getModel(modelId);
  const modelName = model?.name || modelId;

  let prompt = `You are a helpful AI assistant powered by ${modelName}, accessed through Knowledgee — a multi-model AI platform with organizational memory.

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
