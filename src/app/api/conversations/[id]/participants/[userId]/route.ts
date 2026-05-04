import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversationParticipants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getConversationAccess } from "@/lib/conversations/access";

// DELETE /api/conversations/[id]/participants/[userId] — remove a participant.
// Owner can remove anyone; participants can remove themselves (leave).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, userId } = await params;

  const access = await getConversationAccess(id, session.user.id);
  if (!access) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const isSelfRemove = userId === session.user.id;
  if (!access.isOwner && !isSelfRemove) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .delete(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, id),
        eq(conversationParticipants.userId, userId)
      )
    );

  return Response.json({ ok: true });
}
