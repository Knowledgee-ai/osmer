import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// PATCH /api/conversations/[id] — update conversation (title, audience)
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
    teamId?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;

  if (body.visibility !== undefined) {
    if (body.visibility === 'team') {
      if (!body.teamId) {
        return Response.json({ error: "teamId required for team visibility" }, { status: 400 });
      }
      const [membership] = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, body.teamId), eq(teamMembers.userId, session.user.id)))
        .limit(1);
      if (!membership) {
        return Response.json({ error: "Not a member of that team" }, { status: 403 });
      }
      updates.visibility = 'team';
      updates.teamId = body.teamId;
    } else {
      updates.visibility = body.visibility;
      updates.teamId = null;
    }
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

// DELETE /api/conversations/[id] — delete conversation and messages
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Cascade delete handles messages
  await db
    .delete(conversations)
    .where(
      and(eq(conversations.id, id), eq(conversations.userId, session.user.id))
    );

  return Response.json({ ok: true });
}
