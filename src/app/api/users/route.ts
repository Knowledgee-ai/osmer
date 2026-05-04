import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, ne, ilike, or } from "drizzle-orm";

// GET /api/users?q=… — list members of the requester's organisation, used
// by the conversation audience picker. Excludes the requester. Optional
// query string narrows by name/email substring (case-insensitive).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  const [me] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!me?.orgId) {
    return Response.json({ users: [] });
  }

  const matchesQuery = q
    ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
    : undefined;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(
      matchesQuery
        ? and(eq(users.orgId, me.orgId), ne(users.id, session.user.id), matchesQuery)
        : and(eq(users.orgId, me.orgId), ne(users.id, session.user.id))
    )
    .limit(50);

  return Response.json({ users: rows });
}
