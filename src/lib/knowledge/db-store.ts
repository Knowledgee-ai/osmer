import { db } from "@/lib/db";
import { knowledgeAtoms } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";

// Default decay rates per atom type (from PLAN.md OMP spec)
const DECAY_RATES: Record<string, number> = {
  fact: 0.5,
  decision: 0.2,
  preference: 0.3,
  solution: 0.6,
  relationship: 0.4,
  process: 0.7,
  context: 0.9,
};

interface AtomInput {
  type: string;
  content: string;
  confidence: number;
  topics: string[];
  entities: string[];
  sourceConversationId: string;
  extractedBy: string;
  userId: string;
}

export async function saveKnowledgeAtomToDb(atom: AtomInput) {
  // Generate embedding for semantic search
  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(atom.content);
  } catch {
    // Embedding generation is best-effort
  }

  // Check for duplicate/similar knowledge
  if (embedding) {
    const existing = await db.execute(
      sql`SELECT id, content, affirmed_count, version,
          1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
        FROM knowledge_atoms
        WHERE scope_id = ${atom.userId}
          AND status = 'active'
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) > 0.80
        ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
        LIMIT 1`
    );

    if (existing.rows.length > 0) {
      const match = existing.rows[0] as { id: string; content: string; affirmed_count: number; version: number; similarity: number };

      if (match.similarity > 0.92) {
        // Very similar — just affirm existing (same knowledge, re-confirmed)
        await db.execute(
          sql`UPDATE knowledge_atoms
            SET last_affirmed = NOW(),
                affirmed_count = ${match.affirmed_count + 1},
                confidence = LEAST(confidence + 0.05, 1.0),
                updated_at = NOW()
            WHERE id = ${match.id}`
        );
        return { id: match.id, affirmed: true, versioned: false };
      } else {
        // Similar topic but different content — create new version (Knowledge Replay)
        // Archive the old version
        await db.execute(
          sql`UPDATE knowledge_atoms SET status = 'archived', updated_at = NOW() WHERE id = ${match.id}`
        );
        // New atom supersedes the old one
        const decayRate = DECAY_RATES[atom.type] || 0.5;
        const [saved] = await db
          .insert(knowledgeAtoms)
          .values({
            type: atom.type as 'fact' | 'decision' | 'preference' | 'solution' | 'relationship' | 'process' | 'context',
            scope: "personal",
            scopeId: atom.userId,
            content: atom.content,
            confidence: atom.confidence,
            decayRate,
            version: match.version + 1,
            supersedesId: match.id,
            topics: atom.topics,
            structured: { entities: atom.entities },
            sourceConversationId: atom.sourceConversationId,
            sourceUserId: atom.userId,
            extractedBy: atom.extractedBy,
          })
          .returning({ id: knowledgeAtoms.id });

        if (embedding && saved) {
          await db.execute(
            sql`UPDATE knowledge_atoms SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${saved.id}`
          );
        }
        return { id: saved?.id, affirmed: false, versioned: true };
      }
    }
  }

  const decayRate = DECAY_RATES[atom.type] || 0.5;

  const [saved] = await db
    .insert(knowledgeAtoms)
    .values({
      type: atom.type as 'fact' | 'decision' | 'preference' | 'solution' | 'relationship' | 'process' | 'context',
      scope: "personal",
      scopeId: atom.userId,
      content: atom.content,
      confidence: atom.confidence,
      decayRate,
      topics: atom.topics,
      structured: { entities: atom.entities },
      sourceConversationId: atom.sourceConversationId,
      sourceUserId: atom.userId,
      extractedBy: atom.extractedBy,
    })
    .returning({ id: knowledgeAtoms.id });

  // Store embedding
  if (embedding && saved) {
    await db.execute(
      sql`UPDATE knowledge_atoms SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${saved.id}`
    );
  }

  return { id: saved?.id, affirmed: false };
}

export async function promoteKnowledgeToTeam(atomId: string, teamId: string, userId: string) {
  await db.execute(
    sql`UPDATE knowledge_atoms
      SET scope = 'team', scope_id = ${teamId}, updated_at = NOW()
      WHERE id = ${atomId} AND source_user_id = ${userId}`
  );
}

export async function searchKnowledgeByVector(
  query: string,
  userId: string,
  limit: number = 8,
  teamIds?: string[]
): Promise<Array<{ id: string; content: string; type: string; confidence: number; similarity: number }>> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch {
    return searchKnowledgeByText(query, userId, limit);
  }

  // Search personal atoms + team atoms if teamIds provided
  const scopeCondition = teamIds && teamIds.length > 0
    ? sql`(scope_id = ${userId} OR (scope = 'team' AND scope_id = ANY(${teamIds})))`
    : sql`scope_id = ${userId}`;

  const results = await db.execute(
    sql`SELECT id, content, type, confidence,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM knowledge_atoms
      WHERE ${scopeCondition}
        AND status = 'active'
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}`
  );

  return (results.rows as Array<{ id: string; content: string; type: string; confidence: number; similarity: number }>);
}

async function searchKnowledgeByText(
  query: string,
  userId: string,
  limit: number
) {
  const results = await db
    .select({
      id: knowledgeAtoms.id,
      content: knowledgeAtoms.content,
      type: knowledgeAtoms.type,
      confidence: knowledgeAtoms.confidence,
    })
    .from(knowledgeAtoms)
    .where(
      and(
        eq(knowledgeAtoms.scopeId, userId),
        eq(knowledgeAtoms.status, "active")
      )
    )
    .orderBy(desc(knowledgeAtoms.confidence))
    .limit(limit);

  return results.map((r) => ({ ...r, similarity: 0.5 }));
}

export async function getAllKnowledgeAtoms(userId: string, teamIds?: string[]) {
  const scopeCondition = teamIds && teamIds.length > 0
    ? sql`(scope_id = ${userId} OR (scope = 'team' AND scope_id = ANY(${teamIds})))`
    : sql`scope_id = ${userId}`;

  const results = await db.execute(
    sql`SELECT id, type, scope, content, confidence, status, topics, structured,
        created_at, extracted_by, decay_rate, last_affirmed, affirmed_count
      FROM knowledge_atoms
      WHERE ${scopeCondition}
      ORDER BY created_at DESC
      LIMIT 100`
  );

  return results.rows as Array<{
    id: string;
    type: string;
    scope: string;
    content: string;
    confidence: number;
    status: string;
    topics: string[];
    structured: { entities?: string[] };
    created_at: string;
    extracted_by: string;
    decay_rate: number;
    last_affirmed: string;
    affirmed_count: number;
  }>;
}
