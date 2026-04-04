import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/conversations — list user's conversations
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userConversations = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      modelDefault: conversations.modelDefault,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, session.user.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);

  return Response.json({ conversations: userConversations });
}

// POST /api/conversations — create a new conversation
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, title, modelDefault } = await req.json() as {
    id?: string;
    title: string;
    modelDefault: string;
  };

  const [conv] = await db
    .insert(conversations)
    .values({
      ...(id ? { id } : {}),
      userId: session.user.id,
      title,
      modelDefault,
    })
    .returning({
      id: conversations.id,
      title: conversations.title,
      modelDefault: conversations.modelDefault,
      updatedAt: conversations.updatedAt,
    });

  return Response.json({ conversation: conv });
}
