import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { messages, conversations } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

// GET /api/conversations/[id]/messages — load messages for a conversation
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the user owns this conversation
  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(eq(conversations.id, id), eq(conversations.userId, session.user.id))
    )
    .limit(1);

  if (!conv) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const convMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      modelUsed: messages.modelUsed,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  return Response.json({ messages: convMessages });
}

// POST /api/conversations/[id]/messages — save a message
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
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
    })
    .returning({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      modelUsed: messages.modelUsed,
      createdAt: messages.createdAt,
    });

  // Update conversation's updatedAt
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return Response.json({ message: msg });
}
