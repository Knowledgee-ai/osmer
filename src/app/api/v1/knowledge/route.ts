import { db } from '@/lib/db';
import { sql, eq } from 'drizzle-orm';
import { users } from '@/lib/db/schema';
import { retrieve } from '@/lib/memory/retrieve';
import { ingestSource } from '@/lib/memory/ingest';
import { withTenant } from '@/lib/db/tenant';

// External API for programmatic knowledge access. Auth via Bearer token
// (API key stored in user preferences).

async function authenticateApiKey(req: Request): Promise<{ userId: string; orgId: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const apiKey = authHeader.slice(7);
  const result = await db.execute(
    sql`SELECT id, org_id FROM users WHERE preferences->>'externalApiKey' = ${apiKey} LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as { id: string; org_id: string | null };
  if (!row.org_id) return null;
  return { userId: row.id, orgId: row.org_id };
}

// GET /api/v1/knowledge — list or search memory passages
export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return Response.json({ error: 'Invalid API key. Set your key in Settings.' }, { status: 401 });

  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50);

  if (query) {
    const results = await retrieve({
      query,
      scope: { userId: ctx.userId, teamIds: [], orgId: ctx.orgId, includeOrg: true },
      topN: limit,
    });
    return Response.json({
      atoms: results.map((r) => ({ id: r.chunkId, sourceId: r.sourceId, content: r.content, score: r.finalScore })),
      query,
    });
  }

  // No query → list recent active atoms in this org
  const rows = await withTenant(ctx.orgId, async (tx) => {
    return tx.execute(sql`
      SELECT id, type, content, confidence, status, topics, created_at
      FROM memory_atoms
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
  });
  return Response.json({ atoms: rows.rows });
}

// POST /api/v1/knowledge — record a passage into memory programmatically.
// External callers ingest as a "document" source — projection later
// surfaces atoms across what's been recorded.
export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return Response.json({ error: 'Invalid API key' }, { status: 401 });

  const { content, title } = await req.json() as { content: string; title?: string };
  if (!content) return Response.json({ error: 'content is required' }, { status: 400 });

  // Resolve owner user (may differ from API key holder in future; for now they match)
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, ctx.userId)).limit(1);

  const sourceId = await ingestSource({
    orgId: ctx.orgId,
    type: 'document',
    ownerUserId: u?.id ?? null,
    title: title ?? 'API ingest',
    chunks: [{ ord: 0, content }],
    meta: { via: 'external-api' },
  });
  return Response.json({ sourceId });
}
