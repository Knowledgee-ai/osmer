import { sql, and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTenant } from '@/lib/db/tenant';
import { employees, mcpTokens } from '@/lib/db/schema';
import { retrieve } from '@/lib/memory/retrieve';
import { startRun } from '@/lib/agent/runtime';

export interface AuthCtx {
  orgId: string;
  userId: string | null;
}

/**
 * Resolve an MCP bearer token to (orgId, userId). Returns null on
 * miss or if the token has been revoked.
 */
export async function authToken(token: string | null): Promise<AuthCtx | null> {
  if (!token) return null;
  const r = await db.execute(sql`
    SELECT org_id, user_id FROM mcp_tokens
    WHERE token = ${token} AND revoked_at IS NULL
    LIMIT 1
  `);
  const row = r.rows[0] as { org_id: string; user_id: string | null } | undefined;
  return row ? { orgId: row.org_id, userId: row.user_id } : null;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: AuthCtx) => Promise<unknown>;
}

export const MCP_TOOLS: ToolDef[] = [
  {
    name: 'memory.query',
    description: 'Search this organization\'s memory for passages relevant to a query. Returns top-K passages with content and a relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        topK: { type: 'number', default: 8 },
      },
      required: ['query'],
    },
    async handler(args, ctx) {
      const r = await retrieve({
        query: args.query as string,
        scope: { userId: ctx.userId ?? '', teamIds: [], orgId: ctx.orgId, includeOrg: true },
        topN: (args.topK as number) ?? 8,
      });
      return { passages: r.map((x) => ({ content: x.content, score: x.finalScore })) };
    },
  },
  {
    name: 'employee.list',
    description: 'List AI Employees available to this organization.',
    inputSchema: { type: 'object', properties: {} },
    async handler(_args, ctx) {
      const list = await withTenant(ctx.orgId, (tx) =>
        tx
          .select({ id: employees.id, name: employees.name, description: employees.description })
          .from(employees)
          .where(and(eq(employees.orgId, ctx.orgId), eq(employees.status, 'active'))),
      );
      return { employees: list };
    },
  },
  {
    name: 'employee.run',
    description: 'Invoke an AI Employee by id with the given inputs. Returns a run id, status, and output.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        inputs: { type: 'object' },
      },
      required: ['id'],
    },
    async handler(args, ctx) {
      if (!ctx.userId) throw new Error('user-bound MCP token required for employee.run');
      const r = await startRun({
        employeeId: args.id as string,
        orgId: ctx.orgId,
        userId: ctx.userId,
        inputs: (args.inputs as Record<string, unknown>) ?? {},
      });
      return r;
    },
  },
];

export async function issueToken(orgId: string, userId: string | null): Promise<string> {
  const token = `omr_${crypto.randomUUID().replace(/-/g, '')}`;
  await withTenant(orgId, (tx) => tx.insert(mcpTokens).values({ token, orgId, userId }));
  return token;
}

export async function revokeToken(orgId: string, token: string): Promise<void> {
  await withTenant(orgId, (tx) =>
    tx.update(mcpTokens).set({ revokedAt: new Date() }).where(eq(mcpTokens.token, token)),
  );
}
