import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, conversationParticipants, users } from "@/lib/db/schema";
import { eq, desc, or, and, inArray } from "drizzle-orm";

// GET /api/conversations — list conversations the user can access:
// owned, participated in, or org-public in the same organisation.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [me] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Conversations the user explicitly participates in
  const participated = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, session.user.id));
  const participatedIds = participated.map((p) => p.conversationId);

  const ownerMatch = eq(conversations.userId, session.user.id);
  const orgMatch = me?.orgId
    ? and(eq(conversations.visibility, "organization"), eq(conversations.orgId, me.orgId))
    : undefined;
  const participantMatch = participatedIds.length > 0
    ? inArray(conversations.id, participatedIds)
    : undefined;

  const filters = [ownerMatch, orgMatch, participantMatch].filter(Boolean);
  const where = filters.length > 1
    ? or(...(filters as [typeof ownerMatch, ...typeof filters]))
    : filters[0];

  const userConversations = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      modelDefault: conversations.modelDefault,
      visibility: conversations.visibility,
      teamId: conversations.teamId,
      updatedAt: conversations.updatedAt,
      userId: conversations.userId,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.updatedAt))
    .limit(50);

  return Response.json({
    conversations: userConversations.map((c) => ({
      ...c,
      isOwner: c.userId === session.user!.id,
    })),
  });
}

// POST /api/conversations — create a new conversation. Defaults to
// private; visibility can change later via PATCH.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, title, modelDefault, visibility } = await req.json() as {
    id?: string;
    title: string;
    modelDefault: string;
    visibility?: 'private' | 'team' | 'organization';
  };

  const audience: 'private' | 'team' | 'organization' = visibility ?? 'private';

  const [me] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const [conv] = await db
    .insert(conversations)
    .values({
      ...(id ? { id } : {}),
      userId: session.user.id,
      orgId: me?.orgId ?? null,
      title,
      modelDefault,
      visibility: audience,
      teamId: null,
    })
    .returning({
      id: conversations.id,
      title: conversations.title,
      visibility: conversations.visibility,
      teamId: conversations.teamId,
      modelDefault: conversations.modelDefault,
      updatedAt: conversations.updatedAt,
    });

  return Response.json({ conversation: conv });
}
