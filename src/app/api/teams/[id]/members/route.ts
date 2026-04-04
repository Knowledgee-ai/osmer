import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamMembers, users, teams } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/teams/[id]/members — list team members
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;

  // Verify user is a member
  const [membership] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id))
    )
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Not a team member" }, { status: 403 });
  }

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId));

  return Response.json({ members });
}
