import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamMembers, users, teams } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createNotification } from "@/lib/notifications";

// POST /api/teams/[id]/invite — invite a user by email
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { email } = await req.json() as { email: string };

  // Verify caller is a team lead
  const [membership] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id))
    )
    .limit(1);

  if (!membership || membership.role !== "lead") {
    return Response.json({ error: "Only team leads can invite members" }, { status: 403 });
  }

  // Find user by email
  const [invitee] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!invitee) {
    return Response.json({
      error: "User not found. They need to create an Osmer account first.",
    }, { status: 404 });
  }

  // Check if already a member
  const [existing] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, invitee.id))
    )
    .limit(1);

  if (existing) {
    return Response.json({ error: "User is already a team member" }, { status: 409 });
  }

  // Add as member
  await db.insert(teamMembers).values({
    teamId,
    userId: invitee.id,
    role: "member",
  });

  // Notify the invitee
  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
  createNotification(
    invitee.id,
    'team.invite',
    `You've been added to ${team?.name || 'a team'}`,
    `${session.user.name || 'Someone'} invited you to join their team.`,
    '/chat/teams'
  );

  return Response.json({ success: true, member: { id: invitee.id, name: invitee.name, email } });
}
