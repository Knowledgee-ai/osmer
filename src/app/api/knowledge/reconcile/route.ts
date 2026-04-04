import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { knowledgeAtoms, knowledgeConflicts } from '@/lib/db/schema';
import { eq, and, sql, ne } from 'drizzle-orm';

export const maxDuration = 30;

/**
 * POST /api/knowledge/reconcile
 *
 * Runs the knowledge reconciliation engine:
 * 1. Staleness decay — reduce confidence of old atoms
 * 2. Contradiction detection — find atoms with high similarity but different content
 * 3. Returns a report of actions taken
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const report = {
    staleCount: 0,
    decayedCount: 0,
    conflictsFound: 0,
    totalAtoms: 0,
  };

  // 1. Staleness decay
  // Reduce confidence of atoms that haven't been affirmed recently
  // Formula: effective_confidence = confidence * e^(-decay_rate * days_since_affirmed / 365)
  const decayResult = await db.execute(sql`
    UPDATE knowledge_atoms
    SET confidence = confidence * EXP(-decay_rate * EXTRACT(EPOCH FROM (NOW() - last_affirmed)) / (365 * 86400)),
        updated_at = NOW()
    WHERE scope_id = ${userId}
      AND status = 'active'
      AND last_affirmed < NOW() - INTERVAL '7 days'
    RETURNING id
  `);
  report.decayedCount = decayResult.rows.length;

  // 2. Mark atoms as stale if confidence dropped below 0.3
  const staleResult = await db.execute(sql`
    UPDATE knowledge_atoms
    SET status = 'stale', updated_at = NOW()
    WHERE scope_id = ${userId}
      AND status = 'active'
      AND confidence < 0.3
    RETURNING id
  `);
  report.staleCount = staleResult.rows.length;

  // 3. Contradiction detection using vector similarity
  // Find pairs of atoms with high similarity (>0.85) that might contradict each other
  const contradictions = await db.execute(sql`
    SELECT a.id as atom_a_id, b.id as atom_b_id,
      1 - (a.embedding <=> b.embedding) as similarity
    FROM knowledge_atoms a
    JOIN knowledge_atoms b ON a.id < b.id
      AND a.scope_id = b.scope_id
    WHERE a.scope_id = ${userId}
      AND a.status = 'active'
      AND b.status = 'active'
      AND a.embedding IS NOT NULL
      AND b.embedding IS NOT NULL
      AND a.type = b.type
      AND 1 - (a.embedding <=> b.embedding) > 0.85
    LIMIT 10
  `);

  // Insert new conflicts
  for (const row of contradictions.rows as Array<{ atom_a_id: string; atom_b_id: string }>) {
    // Check if conflict already exists
    const existing = await db
      .select({ id: knowledgeConflicts.id })
      .from(knowledgeConflicts)
      .where(
        and(
          eq(knowledgeConflicts.atomAId, row.atom_a_id),
          eq(knowledgeConflicts.atomBId, row.atom_b_id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(knowledgeConflicts).values({
        atomAId: row.atom_a_id,
        atomBId: row.atom_b_id,
        status: 'open',
      });
      report.conflictsFound++;
    }
  }

  // Get total atom count
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM knowledge_atoms WHERE scope_id = ${userId}
  `);
  report.totalAtoms = Number((countResult.rows[0] as { count: string }).count);

  return Response.json({ report });
}
