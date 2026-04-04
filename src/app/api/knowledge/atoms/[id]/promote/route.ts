import { auth } from '@/lib/auth';
import { promoteKnowledgeToTeam } from '@/lib/knowledge/db-store';

// POST /api/knowledge/atoms/[id]/promote — promote atom to team scope
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: atomId } = await params;
  const { teamId } = await req.json() as { teamId: string };

  if (!teamId) {
    return Response.json({ error: "teamId is required" }, { status: 400 });
  }

  await promoteKnowledgeToTeam(atomId, teamId, session.user.id);

  return Response.json({ ok: true });
}
