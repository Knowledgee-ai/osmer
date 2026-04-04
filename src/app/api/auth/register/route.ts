import { db } from "@/lib/db";
import { users, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const { name, email, password } = await req.json() as {
    name: string;
    email: string;
    password: string;
  };

  if (!name || !email || !password) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return Response.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create a personal organization for the user
  const orgSlug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") + "-org";
  const orgName = name + "'s Organization";

  const [org] = await db
    .insert(organizations)
    .values({
      name: orgName,
      slug: orgSlug,
      plan: "free",
    })
    .returning({ id: organizations.id });

  // Create user linked to their organization
  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role: "owner",
      orgId: org.id,
    })
    .returning({ id: users.id, email: users.email, name: users.name });

  logAudit(user.id, 'user.register', 'user', user.id, { email: user.email });

  return Response.json({ user, organization: org });
}
