import { streamText, type ModelMessage } from 'ai';
import { getLanguageModel, estimateCost } from '@/lib/ai/router';
import { getModel } from '@/lib/ai/models';
import { auth } from '@/lib/auth';
import { retrieve } from '@/lib/memory/retrieve';
import { ingestSource } from '@/lib/memory/ingest';
import { db } from '@/lib/db';
import { modelUsage, messages as messagesTable, users } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getConversationAccess, canWrite } from '@/lib/conversations/access';
import { assertSpendOk, recordSpend, SpendExceeded } from '@/lib/spend/caps';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();

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

  // Resolve current user's org for tenant-scoped retrieval + ingestion
  let myOrgId: string | undefined;
  if (session?.user?.id) {
    const [me] = await db
      .select({ orgId: users.orgId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    myOrgId = me?.orgId ?? undefined;
  }

  // Server-side hybrid memory retrieval (semantic + lexical + entity, reranked)
  let knowledgeContext = clientContext;
  if (session?.user?.id && myOrgId && !knowledgeContext) {
    const lastUserMessage = modelMessages.filter((m) => m.role === 'user').pop();
    if (lastUserMessage) {
      try {
        const results = await retrieve({
          query: lastUserMessage.content as string,
          scope: { userId: session.user.id, teamIds: [], orgId: myOrgId, includeOrg: true },
          topN: 8,
        });
        if (results.length > 0) {
          knowledgeContext = results.map((r) => r.content);
        }
      } catch {
        // Retrieval is best-effort; chat keeps working with no memory
      }
    }
  }

  // Pre-flight spend gate. Estimate based on model's input/output rates
  // and roughly 1500 output tokens. Exact cost recorded in onFinish.
  if (myOrgId && session?.user?.id) {
    const lastMsgChars = (modelMessages[modelMessages.length - 1]?.content as string ?? '').length;
    const estCents = Math.ceil(estimateCost(modelId, lastMsgChars / 4, 1500) * 100);
    try {
      await assertSpendOk(myOrgId, session.user.id, 'user_daily', estCents);
      await assertSpendOk(myOrgId, session.user.id, 'org_monthly', estCents);
    } catch (err) {
      if (err instanceof SpendExceeded) {
        return Response.json({ error: 'spend_cap_exceeded', scope: err.scope, cap: err.cap, used: err.used }, { status: 402 });
      }
      throw err;
    }
  }

  const languageModel = getLanguageModel(modelId);
  const systemPrompt = buildSystemPrompt(modelId, knowledgeContext, { multiUser });

  // Capture last user turn so we can ingest the (user, assistant) pair after streaming.
  const lastUserContent = (modelMessages.filter((m) => m.role === 'user').pop()?.content as string | undefined) ?? '';

  const result = streamText({
    model: languageModel,
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ usage, text }) => {
      if (session?.user?.id) {
        const u = (usage as unknown as Record<string, number>) ?? {};
        const tokensIn = u.inputTokens || u.promptTokens || 0;
        const tokensOut = u.outputTokens || u.completionTokens || 0;
        const cost = estimateCost(modelId, tokensIn, tokensOut);

        // 1. Model usage analytics (best-effort)
        db.insert(modelUsage)
          .values({
            userId: session.user.id,
            model: modelId,
            tokensIn,
            tokensOut,
            cost,
          })
          .catch(() => {});

        // 2. Spend ledger (authoritative for caps)
        if (myOrgId) {
          recordSpend(myOrgId, session.user.id, 'chat', Math.round(cost * 100), { modelId, tokensIn, tokensOut })
            .catch((err) => console.error('[chat] recordSpend failed:', err));
        }

        // 3. Verbatim memory ingest of this turn into source_chunks.
        // The conversation envelope is the source; chunks share the
        // conversation id so subsequent turns append to the same source.
        if (myOrgId && conversationId && !conversationId.startsWith('pending-') && lastUserContent && text) {
          // ord is int32; use seconds-since-epoch (fits until 2038) so
          // chunks stay monotonic across appended turns of one conversation.
          const baseOrd = Math.floor(Date.now() / 1000);
          ingestSource({
            sourceId: conversationId,
            orgId: myOrgId,
            type: 'conversation',
            ownerUserId: session.user.id,
            chunks: [
              { ord: baseOrd,     role: 'user',      speakerUserId: session.user.id, content: lastUserContent },
              { ord: baseOrd + 1, role: 'assistant', speakerUserId: null,            content: text },
            ],
          }).catch((err) => {
            console.error('[chat] memory ingest failed:', err instanceof Error ? err.message : err);
          });
        }
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
