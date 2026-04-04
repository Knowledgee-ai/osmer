import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { knowledgeAtoms, knowledgeConflicts } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';

// GET /api/knowledge/stats — knowledge health dashboard data
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get all stats in parallel
  const [
    totalResult,
    byTypeResult,
    byStatusResult,
    avgConfidenceResult,
    topTopicsResult,
    conflictsResult,
    recentResult,
  ] = await Promise.all([
    // Total atoms
    db.execute(sql`
      SELECT COUNT(*) as count FROM knowledge_atoms WHERE scope_id = ${userId}
    `),

    // Count by type
    db.execute(sql`
      SELECT type, COUNT(*) as count
      FROM knowledge_atoms WHERE scope_id = ${userId}
      GROUP BY type ORDER BY count DESC
    `),

    // Count by status
    db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM knowledge_atoms WHERE scope_id = ${userId}
      GROUP BY status ORDER BY count DESC
    `),

    // Average confidence
    db.execute(sql`
      SELECT
        AVG(confidence) as avg_confidence,
        MIN(confidence) as min_confidence,
        MAX(confidence) as max_confidence
      FROM knowledge_atoms
      WHERE scope_id = ${userId} AND status = 'active'
    `),

    // Top topics (from JSONB array)
    db.execute(sql`
      SELECT topic, COUNT(*) as count
      FROM knowledge_atoms, jsonb_array_elements_text(topics) as topic
      WHERE scope_id = ${userId}
      GROUP BY topic ORDER BY count DESC LIMIT 10
    `),

    // Open conflicts
    db.execute(sql`
      SELECT COUNT(*) as count
      FROM knowledge_conflicts kc
      JOIN knowledge_atoms ka ON kc.atom_a_id = ka.id
      WHERE ka.scope_id = ${userId} AND kc.status = 'open'
    `),

    // Recent atoms (last 7 days)
    db.execute(sql`
      SELECT COUNT(*) as count
      FROM knowledge_atoms
      WHERE scope_id = ${userId}
        AND created_at > NOW() - INTERVAL '7 days'
    `),
  ]);

  const total = Number((totalResult.rows[0] as { count: string }).count);
  const byType = (byTypeResult.rows as Array<{ type: string; count: string }>).map(r => ({
    type: r.type,
    count: Number(r.count),
  }));
  const byStatus = (byStatusResult.rows as Array<{ status: string; count: string }>).map(r => ({
    status: r.status,
    count: Number(r.count),
  }));
  const confidence = avgConfidenceResult.rows[0] as { avg_confidence: number | null; min_confidence: number | null; max_confidence: number | null };
  const topTopics = (topTopicsResult.rows as Array<{ topic: string; count: string }>).map(r => ({
    topic: r.topic,
    count: Number(r.count),
  }));
  const openConflicts = Number((conflictsResult.rows[0] as { count: string }).count);
  const recentCount = Number((recentResult.rows[0] as { count: string }).count);

  // Calculate health score (0-100)
  const activeAtoms = byStatus.find(s => s.status === 'active')?.count || 0;
  const staleAtoms = byStatus.find(s => s.status === 'stale')?.count || 0;
  const activeRatio = total > 0 ? activeAtoms / total : 0;
  const avgConf = confidence.avg_confidence || 0;
  const healthScore = Math.round(
    (activeRatio * 40) + // 40% weight: active vs stale ratio
    (avgConf * 40) +     // 40% weight: average confidence
    (Math.min(total / 20, 1) * 10) + // 10% weight: knowledge breadth (caps at 20 atoms)
    ((openConflicts === 0 ? 1 : 0) * 10) // 10% weight: no unresolved conflicts
  );

  return Response.json({
    stats: {
      total,
      byType,
      byStatus,
      confidence: {
        avg: Number(avgConf.toFixed(3)),
        min: Number((confidence.min_confidence || 0).toFixed(3)),
        max: Number((confidence.max_confidence || 0).toFixed(3)),
      },
      topTopics,
      openConflicts,
      recentCount,
      healthScore,
    },
  });
}
