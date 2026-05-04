import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// PATCH /api/conversations/[id] — update conversation (title, audience).
// 'team' visibility uses the conversation_participants table — no
// teamId is required (per-conversation membership replaces fixed teams).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as {
    title?: string;
    visibility?: 'private' | 'team' | 'organization';
  };

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.visibility !== undefined) {
    updates.visibility = body.visibility;
    // We no longer pin conversations to a fixed team; participants are
    // per-conversation. Clear any legacy teamId on visibility change.
    updates.teamId = null;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No updates" }, { status: 400 });
  }

  const [conv] = await db
    .update(conversations)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(eq(conversations.id, id), eq(conversations.userId, session.user.id))
    )
    .returning({
      id: conversations.id,
      title: conversations.title,
      visibility: conversations.visibility,
      teamId: conversations.teamId,
    });

  if (!conv) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ conversation: conv });
}

// DELETE /api/conversations/[id] — delete conversation and messages.
// Owner-only; cascade handles messages and participants.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .delete(conversations)
    .where(
      and(eq(conversations.id, id), eq(conversations.userId, session.user.id))
    );

  return Response.json({ ok: true });
}
