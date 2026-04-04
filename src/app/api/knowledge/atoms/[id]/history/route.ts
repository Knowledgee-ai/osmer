import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/knowledge/atoms/[id]/history — get version history (Knowledge Replay)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Walk the version chain backwards (current → supersedes → supersedes → ...)
  const history = await db.execute(sql`
    WITH RECURSIVE version_chain AS (
      -- Start with the given atom
      SELECT id, content, type, confidence, version, supersedes_id, status,
             source_conversation_id, extracted_by, created_at
      FROM knowledge_atoms
      WHERE id = ${id} AND (scope_id = ${session.user.id} OR scope = 'team')

      UNION ALL

      -- Walk backwards through supersedes chain
      SELECT ka.id, ka.content, ka.type, ka.confidence, ka.version, ka.supersedes_id, ka.status,
             ka.source_conversation_id, ka.extracted_by, ka.created_at
      FROM knowledge_atoms ka
      INNER JOIN version_chain vc ON ka.id = vc.supersedes_id
    )
    SELECT * FROM version_chain ORDER BY version ASC
  `);

  // Also check if there are newer versions that supersede this atom
  const newer = await db.execute(sql`
    WITH RECURSIVE forward_chain AS (
      SELECT id, content, type, confidence, version, supersedes_id, status,
             source_conversation_id, extracted_by, created_at
      FROM knowledge_atoms
      WHERE supersedes_id = ${id}

      UNION ALL

      SELECT ka.id, ka.content, ka.type, ka.confidence, ka.version, ka.supersedes_id, ka.status,
             ka.source_conversation_id, ka.extracted_by, ka.created_at
      FROM knowledge_atoms ka
      INNER JOIN forward_chain fc ON ka.supersedes_id = fc.id
    )
    SELECT * FROM forward_chain ORDER BY version ASC
  `);

  const allVersions = [...(history.rows as Array<Record<string, unknown>>), ...(newer.rows as Array<Record<string, unknown>>)];

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = allVersions.filter((v) => {
    const vid = v.id as string;
    if (seen.has(vid)) return false;
    seen.add(vid);
    return true;
  });

  return Response.json({
    timeline: unique.map((v) => ({
      id: v.id,
      content: v.content,
      type: v.type,
      confidence: v.confidence,
      version: v.version,
      status: v.status,
      extractedBy: v.extracted_by,
      createdAt: v.created_at,
    })),
  });
}
