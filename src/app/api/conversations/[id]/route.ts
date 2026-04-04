import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// PATCH /api/conversations/[id] — update conversation (title, etc.)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const updates = await req.json() as { title?: string };

  const [conv] = await db
    .update(conversations)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(eq(conversations.id, id), eq(conversations.userId, session.user.id))
    )
    .returning({ id: conversations.id, title: conversations.title });

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
