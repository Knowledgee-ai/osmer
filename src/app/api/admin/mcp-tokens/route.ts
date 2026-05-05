import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { mcpTokens, users } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';
import { issueToken, revokeToken } from '@/lib/mcp/handler';

async function adminOrg(userId: string): Promise<{ orgId: string; isAdmin: boolean } | null> {
  const [me] = await db.select({ orgId: users.orgId, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!me?.orgId) return null;
  return { orgId: me.orgId, isAdmin: me.role === 'admin' || me.role === 'owner' };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const ctx = await adminOrg(session.user.id);
  if (!ctx?.isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });

  const list = await withTenant(ctx.orgId, (tx) =>
    tx.execute(sql`
      SELECT
        SUBSTRING(token FROM 1 FOR 12) AS prefix,
        user_id,
        created_at,
        revoked_at
      FROM mcp_tokens
      ORDER BY created_at DESC
      LIMIT 50
    `),
  );
  return Response.json({ tokens: list.rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const ctx = await adminOrg(session.user.id);
  if (!ctx?.isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });

  const { boundToUser } = await req.json().catch(() => ({})) as { boundToUser?: boolean };
  const userId = boundToUser ? session.user.id : null;
  const token = await issueToken(ctx.orgId, userId);
  return Response.json({
    token,
    boundToUser: !!userId,
    note: 'This is the only time the full token will be shown. Revoke via DELETE /api/admin/mcp-tokens?token=<token>.',
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const ctx = await adminOrg(session.user.id);
  if (!ctx?.isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return Response.json({ error: 'token required' }, { status: 400 });
  await revokeToken(ctx.orgId, token);
  return Response.json({ ok: true });
}
