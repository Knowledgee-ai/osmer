import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/knowledge/graph — knowledge graph data for visualization
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ nodes: [], edges: [] });
  }

  const userId = session.user.id;

  // Get atoms as nodes
  const atoms = await db.execute(sql`
    SELECT id, type, content, confidence, topics, structured, status
    FROM knowledge_atoms
    WHERE scope_id = ${userId} AND status = 'active'
    ORDER BY confidence DESC
    LIMIT 50
  `);

  // Extract entities from atoms to create entity nodes
  const entityMap = new Map<string, { name: string; atomIds: string[] }>();
  const atomRows = atoms.rows as Array<{
    id: string; type: string; content: string; confidence: number;
    topics: string[]; structured: { entities?: string[] }; status: string;
  }>;

  for (const atom of atomRows) {
    const entities = atom.structured?.entities || [];
    for (const entity of entities) {
      const key = entity.toLowerCase();
      if (!entityMap.has(key)) {
        entityMap.set(key, { name: entity, atomIds: [] });
      }
      entityMap.get(key)!.atomIds.push(atom.id);
    }
  }

  // Build nodes (atoms + entities)
  const nodes = [
    ...atomRows.map((a) => ({
      id: a.id,
      type: 'atom' as const,
      label: a.content.substring(0, 60) + (a.content.length > 60 ? '...' : ''),
      atomType: a.type,
      confidence: a.confidence,
      size: Math.max(a.confidence * 30, 10),
    })),
    ...Array.from(entityMap.entries()).map(([key, val]) => ({
      id: `entity-${key}`,
      type: 'entity' as const,
      label: val.name,
      atomType: 'entity',
      confidence: 1,
      size: Math.min(val.atomIds.length * 15, 50),
    })),
  ];

  // Build edges (atom -> entity connections)
  const edges: Array<{ source: string; target: string }> = [];
  for (const [key, val] of entityMap) {
    for (const atomId of val.atomIds) {
      edges.push({ source: atomId, target: `entity-${key}` });
    }
  }

  // Also connect atoms that share topics
  for (let i = 0; i < atomRows.length; i++) {
    for (let j = i + 1; j < atomRows.length; j++) {
      const shared = (atomRows[i].topics || []).filter(t =>
        (atomRows[j].topics || []).includes(t)
      );
      if (shared.length > 0) {
        edges.push({ source: atomRows[i].id, target: atomRows[j].id });
      }
    }
  }

  return Response.json({ nodes, edges });
}
