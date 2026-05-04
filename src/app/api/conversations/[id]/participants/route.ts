import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversationParticipants, users } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getConversationAccess, canRead } from "@/lib/conversations/access";

// GET /api/conversations/[id]/participants — list participants (with user
// info) plus the owner. Anyone with read access can list.
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
  if (!access) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canRead(access)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [owner] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, access.conversation.ownerId))
    .limit(1);

  const invited = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      joinedAt: conversationParticipants.joinedAt,
    })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(eq(conversationParticipants.conversationId, id));

  return Response.json({
    owner: owner ?? null,
    participants: invited,
  });
}

// POST /api/conversations/[id]/participants — invite a user by id.
// Owner-only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { userId } = await req.json() as { userId: string };
  if (!userId) {
    return Response.json({ error: "userId required" }, { status: 400 });
  }

  const access = await getConversationAccess(id, session.user.id);
  if (!access) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!access.isOwner) {
    return Response.json({ error: "Only the owner can invite" }, { status: 403 });
  }
  if (userId === access.conversation.ownerId) {
    return Response.json({ error: "Owner is implicit" }, { status: 400 });
  }

  // Same-org check
  const [me] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const [target] = await db
    .select({ id: users.id, orgId: users.orgId, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
    .from(users)
    .where(and(eq(users.id, userId), ne(users.id, session.user.id)))
    .limit(1);
  if (!target || !me?.orgId || target.orgId !== me.orgId) {
    return Response.json({ error: "Member not in your organisation" }, { status: 404 });
  }

  await db
    .insert(conversationParticipants)
    .values({ conversationId: id, userId })
    .onConflictDoNothing();

  return Response.json({
    participant: { id: target.id, name: target.name, email: target.email, avatarUrl: target.avatarUrl },
  });
}
