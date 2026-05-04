import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, teamMembers } from "@/lib/db/schema";
import { eq, desc, or, and, sql, inArray } from "drizzle-orm";

// GET /api/conversations — list user's conversations + team conversations
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's team IDs
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, session.user.id));

  const teamIds = userTeams.map((t) => t.teamId);

  // Fetch personal + team conversations
  let userConversations;
  if (teamIds.length > 0) {
    userConversations = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        modelDefault: conversations.modelDefault,
        visibility: conversations.visibility,
        teamId: conversations.teamId,
        updatedAt: conversations.updatedAt,
        userId: conversations.userId,
      })
      .from(conversations)
      .where(
        or(
          eq(conversations.userId, session.user.id),
          and(
            eq(conversations.visibility, "team"),
            inArray(conversations.teamId, teamIds)
          )
        )
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(50);
  } else {
    userConversations = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        modelDefault: conversations.modelDefault,
        visibility: conversations.visibility,
        teamId: conversations.teamId,
        updatedAt: conversations.updatedAt,
        userId: conversations.userId,
      })
      .from(conversations)
      .where(eq(conversations.userId, session.user.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(50);
  }

  return Response.json({
    conversations: userConversations.map((c) => ({
      ...c,
      isOwner: c.userId === session.user!.id,
    })),
  });
}

// POST /api/conversations — create a new conversation
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, title, modelDefault, teamId, visibility } = await req.json() as {
    id?: string;
    title: string;
    modelDefault: string;
    teamId?: string | null;
    visibility?: 'private' | 'team' | 'organization';
  };

  const audience: 'private' | 'team' | 'organization' = visibility ?? 'private';
  let resolvedTeamId: string | null = null;

  if (audience === 'team') {
    if (!teamId) {
      return Response.json({ error: "teamId required for team visibility" }, { status: 400 });
    }
    const [membership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id)))
      .limit(1);
    if (!membership) {
      return Response.json({ error: "Not a member of that team" }, { status: 403 });
    }
    resolvedTeamId = teamId;
  }

  const [conv] = await db
    .insert(conversations)
    .values({
      ...(id ? { id } : {}),
      userId: session.user.id,
      title,
      modelDefault,
      teamId: resolvedTeamId,
      visibility: audience,
    })
    .returning({
      id: conversations.id,
      title: conversations.title,
      modelDefault: conversations.modelDefault,
      visibility: conversations.visibility,
      teamId: conversations.teamId,
      updatedAt: conversations.updatedAt,
    });

  return Response.json({ conversation: conv });
}
