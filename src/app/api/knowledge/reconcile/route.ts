import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { knowledgeAtoms, knowledgeConflicts, users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

export const maxDuration = 30;

// Auto-promotion thresholds
const PERSONAL_TO_TEAM_AFFIRMATIONS = 3; // distinct users on the same team affirming similar atoms
const PERSONAL_TO_TEAM_SIMILARITY = 0.85;
const TEAM_TO_ORG_DAYS = 30;
const TEAM_TO_ORG_MIN_CONFIDENCE = 0.7;

/**
 * POST /api/knowledge/reconcile
 *
 * Runs the knowledge reconciliation engine:
 * 1. Staleness decay — reduce confidence of old atoms
 * 2. Contradiction detection — find atoms with high similarity but different content
 * 3. Auto-promotion (admin/owner only): personal→team and team→org based on stability rules
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [me] = await db
    .select({ role: users.role, orgId: users.orgId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const isAdmin = me?.role === 'admin' || me?.role === 'owner';

  const report = {
    staleCount: 0,
    decayedCount: 0,
    conflictsFound: 0,
    totalAtoms: 0,
    promotedToTeam: 0,
    promotedToOrg: 0,
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

  // 4. Org-wide auto-promotion (admin/owner only)
  if (isAdmin && me?.orgId) {
    // 4a. Personal → Team: when N distinct users on the same team have similar atoms,
    //     promote one representative atom to that team's scope. Archive the others as merged.
    const personalToTeam = await db.execute(sql`
      WITH similar_groups AS (
        SELECT
          a.id AS rep_id,
          a.content AS rep_content,
          a.type AS rep_type,
          tm.team_id,
          ARRAY_AGG(DISTINCT b.id) AS dup_ids,
          COUNT(DISTINCT b.scope_id) AS distinct_users
        FROM knowledge_atoms a
        JOIN knowledge_atoms b
          ON b.id <> a.id
          AND b.scope = 'personal'
          AND b.status = 'active'
          AND b.embedding IS NOT NULL
          AND b.type = a.type
          AND b.org_id = a.org_id
          AND 1 - (a.embedding <=> b.embedding) > ${PERSONAL_TO_TEAM_SIMILARITY}
        JOIN team_members tm_a ON tm_a.user_id = a.scope_id
        JOIN team_members tm   ON tm.user_id = b.scope_id AND tm.team_id = tm_a.team_id
        WHERE a.scope = 'personal'
          AND a.status = 'active'
          AND a.embedding IS NOT NULL
          AND a.org_id = ${me.orgId}
        GROUP BY a.id, a.content, a.type, tm.team_id
        HAVING COUNT(DISTINCT b.scope_id) + 1 >= ${PERSONAL_TO_TEAM_AFFIRMATIONS}
      )
      SELECT rep_id, team_id, dup_ids FROM similar_groups
      LIMIT 50
    `);

    for (const row of personalToTeam.rows as Array<{ rep_id: string; team_id: string; dup_ids: string[] }>) {
      // Promote the representative to team scope
      await db.execute(sql`
        UPDATE knowledge_atoms
          SET scope = 'team', scope_id = ${row.team_id}, updated_at = NOW()
          WHERE id = ${row.rep_id} AND scope = 'personal'
      `);
      // Archive the duplicates as merged
      if (row.dup_ids.length > 0) {
        await db.execute(sql`
          UPDATE knowledge_atoms
            SET status = 'archived', supersedes_id = ${row.rep_id}, updated_at = NOW()
            WHERE id = ANY(${row.dup_ids}) AND scope = 'personal'
        `);
      }
      report.promotedToTeam++;
      logAudit(userId, 'knowledge.promote', 'knowledge', row.rep_id, {
        from: 'personal',
        to: 'team',
        teamId: row.team_id,
        merged: row.dup_ids.length,
        reason: `>=${PERSONAL_TO_TEAM_AFFIRMATIONS} distinct affirmations`,
      });
    }

    // 4b. Team → Org: stable team atoms (>= TEAM_TO_ORG_DAYS old, confidence >= threshold,
    //     no open conflicts) get promoted to organization scope.
    const teamToOrg = await db.execute(sql`
      SELECT ka.id
      FROM knowledge_atoms ka
      WHERE ka.org_id = ${me.orgId}
        AND ka.scope = 'team'
        AND ka.status = 'active'
        AND ka.confidence >= ${TEAM_TO_ORG_MIN_CONFIDENCE}
        AND ka.created_at < NOW() - (INTERVAL '1 day' * ${TEAM_TO_ORG_DAYS})
        AND NOT EXISTS (
          SELECT 1 FROM knowledge_conflicts kc
          WHERE (kc.atom_a_id = ka.id OR kc.atom_b_id = ka.id)
            AND kc.status = 'open'
        )
      LIMIT 50
    `);

    for (const row of teamToOrg.rows as Array<{ id: string }>) {
      await db.execute(sql`
        UPDATE knowledge_atoms
          SET scope = 'organization', scope_id = ${me.orgId}, updated_at = NOW()
          WHERE id = ${row.id} AND scope = 'team'
      `);
      report.promotedToOrg++;
      logAudit(userId, 'knowledge.promote', 'knowledge', row.id, {
        from: 'team',
        to: 'organization',
        reason: `stable for >= ${TEAM_TO_ORG_DAYS} days, conf >= ${TEAM_TO_ORG_MIN_CONFIDENCE}`,
      });
    }
  }

  return Response.json({ report });
}
