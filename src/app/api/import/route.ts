import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';

export const maxDuration = 60;

// POST /api/import — import conversations from ChatGPT export format
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, source } = await req.json() as {
    data: unknown;
    source: 'chatgpt' | 'claude' | 'generic';
  };

  let imported = 0;
  let messageCount = 0;

  try {
    if (source === 'chatgpt') {
      // ChatGPT export format: array of conversations
      const convs = data as Array<{
        title: string;
        create_time: number;
        mapping: Record<string, {
          message?: {
            author: { role: string };
            content: { parts: string[] };
            create_time: number;
          };
        }>;
      }>;

      for (const conv of convs.slice(0, 50)) { // Limit to 50 conversations
        const [newConv] = await db
          .insert(conversations)
          .values({
            userId: session.user.id,
            title: conv.title || 'Imported Chat',
            modelDefault: 'openai/gpt-5.5',
            visibility: 'private',
          })
          .returning({ id: conversations.id });

        // Extract messages from ChatGPT's mapping format
        const msgs = Object.values(conv.mapping || {})
          .filter((m) => m.message && ['user', 'assistant'].includes(m.message.author.role))
          .sort((a, b) => (a.message!.create_time || 0) - (b.message!.create_time || 0))
          .map((m) => ({
            conversationId: newConv.id,
            role: m.message!.author.role as 'user' | 'assistant',
            content: m.message!.content.parts?.join('') || '',
            modelUsed: m.message!.author.role === 'assistant' ? 'openai/gpt-5.5' : null,
          }))
          .filter((m) => m.content.length > 0);

        if (msgs.length > 0) {
          await db.insert(messages).values(msgs);
          messageCount += msgs.length;
        }
        imported++;
      }
    } else {
      // Generic format: array of { title, messages: [{ role, content }] }
      const convs = data as Array<{
        title: string;
        messages: Array<{ role: string; content: string; model?: string }>;
      }>;

      for (const conv of convs.slice(0, 50)) {
        const [newConv] = await db
          .insert(conversations)
          .values({
            userId: session.user.id,
            title: conv.title || 'Imported Chat',
            modelDefault: 'unknown',
            visibility: 'private',
          })
          .returning({ id: conversations.id });

        const msgs = conv.messages
          .filter((m) => ['user', 'assistant'].includes(m.role) && m.content)
          .map((m) => ({
            conversationId: newConv.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            modelUsed: m.model || null,
          }));

        if (msgs.length > 0) {
          await db.insert(messages).values(msgs);
          messageCount += msgs.length;
        }
        imported++;
      }
    }

    logAudit(session.user.id, 'conversation.create', 'conversation', undefined, {
      source,
      importedCount: imported,
      messageCount,
    });

    return Response.json({
      imported,
      messageCount,
      message: `Imported ${imported} conversations with ${messageCount} messages`,
    });
  } catch (error) {
    return Response.json({
      error: "Import failed: " + (error instanceof Error ? error.message : "Unknown error"),
    }, { status: 400 });
  }
}
