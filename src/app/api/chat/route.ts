import { streamText, type ModelMessage } from 'ai';
import { getLanguageModel, getLanguageModelWithKeys, estimateCost } from '@/lib/ai/router';
import { getModel } from '@/lib/ai/models';
import { auth } from '@/lib/auth';
import { searchKnowledgeByVector } from '@/lib/knowledge/db-store';
import { db } from '@/lib/db';
import { modelUsage, messages as messagesTable, users } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getConversationAccess, canWrite } from '@/lib/conversations/access';

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

  // Default: trust the client's message stream (single-speaker case)
  let modelMessages: ModelMessage[] = rawMessages.map((msg) => {
    const content = msg.content || msg.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '';
    return {
      role: msg.role as 'user' | 'assistant' | 'system',
      content,
    };
  });

  // Multi-user attribution: when this conversation is shared (not
  // private), reconstruct the history from the DB with sender names and
  // prefix each user turn with `[Name]: ` so the model can distinguish
  // speakers. Falls back silently to the client payload on any error.
  let multiUser = false;
  let currentSpeakerName: string | undefined;
  if (
    session?.user?.id &&
    conversationId &&
    !conversationId.startsWith('pending-')
  ) {
    try {
      const access = await getConversationAccess(conversationId, session.user.id);
      if (access && canWrite(access) && access.conversation.visibility !== 'private') {
        const persisted = await db
          .select({
            role: messagesTable.role,
            content: messagesTable.content,
            senderName: users.name,
            userId: messagesTable.userId,
          })
          .from(messagesTable)
          .leftJoin(users, eq(users.id, messagesTable.userId))
          .where(eq(messagesTable.conversationId, conversationId))
          .orderBy(asc(messagesTable.createdAt));

        const distinctSenders = new Set(
          persisted.filter((m) => m.role === 'user' && m.userId).map((m) => m.userId as string)
        );

        // Look up the current speaker even if they aren't in history yet
        // — they might be sending the first message of a multi-user thread.
        const [me] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, session.user.id))
          .limit(1);
        currentSpeakerName = me?.name ?? undefined;

        // Multi-user is "true" if there are already 2+ distinct senders,
        // or if the current sender adds a new identity to the thread.
        if (
          distinctSenders.size >= 2 ||
          (distinctSenders.size === 1 && !distinctSenders.has(session.user.id))
        ) {
          multiUser = true;
        }

        if (multiUser) {
          // Rebuild from DB so historical attribution is authoritative.
          // The client's payload may include the just-typed user message
          // (not yet persisted) — append it with the current speaker's name.
          const dbAsModel: ModelMessage[] = persisted.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content:
              m.role === 'user' && m.senderName
                ? `[${m.senderName}]: ${m.content}`
                : m.content,
          }));

          // Drop assistant messages from the client payload (we have them
          // in DB) and isolate any trailing user message that was newly
          // typed and not yet persisted.
          const lastClientMsg = modelMessages[modelMessages.length - 1];
          const lastPersistedUserContent = [...persisted].reverse().find(
            (m) => m.role === 'user'
          )?.content;
          const newUserMessage =
            lastClientMsg?.role === 'user' &&
            lastClientMsg.content !== lastPersistedUserContent
              ? lastClientMsg
              : null;

          modelMessages = dbAsModel;
          if (newUserMessage) {
            const prefixed = currentSpeakerName
              ? `[${currentSpeakerName}]: ${newUserMessage.content}`
              : newUserMessage.content;
            modelMessages.push({ role: 'user', content: prefixed as string });
          }
        }
      }
    } catch {
      // Fall back to client payload on any DB hiccup
    }
  }

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

  const systemPrompt = buildSystemPrompt(modelId, knowledgeContext, { multiUser });

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

function buildSystemPrompt(
  modelId: string,
  knowledgeContext?: string[],
  opts?: { multiUser?: boolean }
): string {
  const model = getModel(modelId);
  const modelName = model?.name || modelId;

  let prompt = `You are a helpful AI assistant powered by ${modelName}, accessed through Osmer, a multi-model AI platform with organizational memory.

Be concise, accurate, and helpful. If you're unsure about something, say so rather than guessing.`;

  if (opts?.multiUser) {
    prompt += `

## Multiple participants

This conversation has more than one human participant. User messages
are prefixed with the speaker's name in square brackets, like:

  [Ana]: how should we shard the events table?
  [Lucas]: I'd hash by tenant_id

When you reply, address the most recent speaker by name where it
helps clarity, and reference earlier speakers by name when their
input is relevant. Do NOT use the bracketed prefix in your own
responses — it's a formatting convention for user turns only.`;
  }

  if (knowledgeContext && knowledgeContext.length > 0) {
    prompt += `

## Organizational Knowledge Context

The following knowledge has been extracted from previous conversations and is relevant to the current discussion. Use this context to provide more informed responses:

${knowledgeContext.map((k, i) => `${i + 1}. ${k}`).join('\n')}

Use this context naturally — don't explicitly mention the knowledge base unless the user asks about it.`;
  }

  return prompt;
}
