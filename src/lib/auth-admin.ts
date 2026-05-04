import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface AdminContext {
  userId: string;
  orgId: string | null;
  role: 'owner' | 'admin';
}

/**
 * Loads the session user and verifies they have admin or owner role.
 * Returns either the admin context, or a Response to forward back to the caller.
 */
export async function requireAdmin(): Promise<{ ctx: AdminContext } | { error: Response }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const [user] = await db
    .select({ id: users.id, role: users.role, orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (user.role !== 'admin' && user.role !== 'owner') {
    return { error: Response.json({ error: "Admin role required" }, { status: 403 }) };
  }

  return { ctx: { userId: user.id, orgId: user.orgId, role: user.role } };
}
