import { generateObject } from 'ai';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';
import { memoryAtoms, sourceChunks } from '@/lib/db/schema';
import { getLanguageModel } from '@/lib/ai/router';
import { embed, currentEmbeddingVersion } from './embed';

const PROJECTION_MODEL = process.env.PROJECTION_MODEL ?? 'anthropic/claude-sonnet-4-6';

const SUPERSEDE_SIM = 0.92;
const NEW_VERSION_SIM = 0.80;

const AtomsSchema = z.object({
  atoms: z.array(z.object({
    type: z.enum(['fact', 'decision', 'preference']),
    content: z.string(),
    confidence: z.number().min(0).max(1),
    topics: z.array(z.string()).default([]),
  })),
});

export interface ProjectionReport {
  examined: number;
  proposed: number;
  created: number;
  affirmed: number;
  superseded: number;
}

/**
 * Project recent chunks into atoms.
 *
 * For each candidate atom emitted by the model:
 *  - similarity > 0.92 → affirm the existing atom (bump count, refresh)
 *  - similarity > 0.80 → archive the existing atom, create new (versioned)
 *  - otherwise         → create new
 */
export async function projectAtoms(
  orgId: string,
  scopeUserId: string | null,
  sinceHours = 24,
): Promise<ProjectionReport> {
  return withTenant(orgId, async (tx) => {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const recent = await tx
      .select({ id: sourceChunks.id, content: sourceChunks.content, ord: sourceChunks.ord })
      .from(sourceChunks)
      .where(sql`${sourceChunks.createdAt} >= ${since}`);

    if (recent.length < 2) {
      return { examined: recent.length, proposed: 0, created: 0, affirmed: 0, superseded: 0 };
    }

    const formatted = recent
      .map((c) => `[${c.id}] ${c.content}`)
      .join('\n\n')
      .slice(0, 30_000);

    let proposed: Array<{ type: 'fact' | 'decision' | 'preference'; content: string; confidence: number; topics: string[] }> = [];
    try {
      const { object } = await generateObject({
        model: getLanguageModel(PROJECTION_MODEL),
        schema: AtomsSchema,
        prompt: `You are a knowledge projection engine.

Below are recent chunks from one organization's memory. Extract reusable atoms (facts, decisions, preferences) that hold ACROSS multiple chunks or describe stable patterns. Each atom must be a single clear standalone statement. Skip transient task details, small talk, and one-off questions.

When in doubt, do not extract. Quality over volume — 2 strong atoms beats 10 mediocre ones.

Chunks:
${formatted}`,
      });
      proposed = object.atoms;
    } catch (err) {
      console.error('[projection] generation failed:', err instanceof Error ? err.message : err);
      return { examined: recent.length, proposed: 0, created: 0, affirmed: 0, superseded: 0 };
    }

    let created = 0, affirmed = 0, superseded = 0;
    for (const a of proposed) {
      const { vector } = await embed(a.content);
      const vecLit = JSON.stringify(vector);

      const existingRows = await tx.execute(sql`
        SELECT id, content, affirmed_count,
          1 - (embedding <=> ${vecLit}::vector) AS sim
        FROM memory_atoms
        WHERE status = 'active'
          AND embedding IS NOT NULL
          ${scopeUserId ? sql`AND scope_user_id = ${scopeUserId}` : sql``}
        ORDER BY embedding <=> ${vecLit}::vector
        LIMIT 1
      `);
      const match = existingRows.rows[0] as { id: string; content: string; affirmed_count: number; sim: number } | undefined;

      if (match && match.sim > SUPERSEDE_SIM) {
        await tx.execute(sql`
          UPDATE memory_atoms
          SET affirmed_count = affirmed_count + 1,
              last_affirmed = NOW(),
              confidence = LEAST(confidence + 0.05, 1.0),
              updated_at = NOW()
          WHERE id = ${match.id}
        `);
        affirmed++;
        continue;
      }

      let supersedesId: string | null = null;
      if (match && match.sim > NEW_VERSION_SIM) {
        await tx.execute(sql`
          UPDATE memory_atoms
          SET status = 'superseded', invalid_at = NOW(), updated_at = NOW()
          WHERE id = ${match.id}
        `);
        supersedesId = match.id;
        superseded++;
      }

      const [row] = await tx.insert(memoryAtoms).values({
        orgId,
        scopeUserId: scopeUserId ?? null,
        type: a.type,
        content: a.content,
        confidence: a.confidence,
        topics: a.topics,
        sourceIds: recent.map((c) => c.id),
        supersedesId,
        embeddingVersion: currentEmbeddingVersion,
      }).returning({ id: memoryAtoms.id });

      await tx.execute(sql`UPDATE memory_atoms SET embedding = ${vecLit}::vector WHERE id = ${row.id}`);
      created++;
    }

    return { examined: recent.length, proposed: proposed.length, created, affirmed, superseded };
  });
}
