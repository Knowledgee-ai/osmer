import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, teamMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/teams — list user's teams
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's org
  const [user] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.orgId) {
    return Response.json({ teams: [] });
  }

  // Get teams user belongs to
  const userTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      role: teamMembers.role,
      createdAt: teams.createdAt,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, session.user.id));

  return Response.json({ teams: userTeams });
}

// POST /api/teams — create a new team
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json() as { name: string };

  if (!name || name.length < 2) {
    return Response.json({ error: "Team name must be at least 2 characters" }, { status: 400 });
  }

  // Get user's org
  const [user] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.orgId) {
    return Response.json({ error: "No organization found" }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const [team] = await db
    .insert(teams)
    .values({
      orgId: user.orgId,
      name,
      slug,
    })
    .returning({ id: teams.id, name: teams.name, slug: teams.slug });

  // Add creator as team lead
  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: session.user.id,
    role: "lead",
  });

  return Response.json({ team });
}
