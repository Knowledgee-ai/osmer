import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { knowledgeAtoms } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// DELETE /api/knowledge/atoms/[id] — delete a knowledge atom
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
    .delete(knowledgeAtoms)
    .where(
      and(
        eq(knowledgeAtoms.id, id),
        eq(knowledgeAtoms.scopeId, session.user.id)
      )
    );

  return Response.json({ ok: true });
}
