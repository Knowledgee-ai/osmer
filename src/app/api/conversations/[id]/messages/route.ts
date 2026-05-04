import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { messages, conversations, users } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getConversationAccess, canRead, canWrite } from "@/lib/conversations/access";

// GET /api/conversations/[id]/messages — load messages + sender attribution.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getConversationAccess(id, session.user.id);
  if (!access) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canRead(access)) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Left-join users for sender attribution. Returns null for assistant
  // turns and for legacy messages without a userId.
  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      modelUsed: messages.modelUsed,
      createdAt: messages.createdAt,
      userId: messages.userId,
      senderName: users.name,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.userId))
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  return Response.json({ messages: rows });
}

// POST /api/conversations/[id]/messages — save a message. Persists the
// sender's userId so multi-user conversations can attribute later.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const access = await getConversationAccess(conversationId, session.user.id);
  if (!access) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canWrite(access)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id, role, content, modelUsed } = await req.json() as {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    modelUsed?: string;
  };

  const [msg] = await db
    .insert(messages)
    .values({
      ...(id ? { id } : {}),
      conversationId,
      role,
      content,
      modelUsed,
      // Only attribute user turns; assistant turns are model-authored.
      userId: role === 'user' ? session.user.id : null,
    })
    .returning({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      modelUsed: messages.modelUsed,
      createdAt: messages.createdAt,
      userId: messages.userId,
    });

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return Response.json({ message: msg });
}
