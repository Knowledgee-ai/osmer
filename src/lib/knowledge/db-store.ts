import { db } from "@/lib/db";
import { knowledgeAtoms } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";

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

  const [saved] = await db
    .insert(knowledgeAtoms)
    .values({
      type: atom.type as 'fact' | 'decision' | 'preference' | 'solution' | 'relationship' | 'process' | 'context',
      scope: "personal",
      scopeId: atom.userId,
      content: atom.content,
      confidence: atom.confidence,
      topics: atom.topics,
      structured: { entities: atom.entities },
      sourceConversationId: atom.sourceConversationId,
      sourceUserId: atom.userId,
      extractedBy: atom.extractedBy,
    })
    .returning({ id: knowledgeAtoms.id });

  // Store embedding separately since Drizzle doesn't have native vector support
  if (embedding && saved) {
    await db.execute(
      sql`UPDATE knowledge_atoms SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${saved.id}`
    );
  }

  return saved;
}

export async function searchKnowledgeByVector(
  query: string,
  userId: string,
  limit: number = 8
): Promise<Array<{ id: string; content: string; type: string; confidence: number; similarity: number }>> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch {
    // Fall back to simple text search if embedding fails
    return searchKnowledgeByText(query, userId, limit);
  }

  const results = await db.execute(
    sql`SELECT id, content, type, confidence,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM knowledge_atoms
      WHERE scope_id = ${userId}
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

export async function getAllKnowledgeAtoms(userId: string) {
  return db
    .select({
      id: knowledgeAtoms.id,
      type: knowledgeAtoms.type,
      content: knowledgeAtoms.content,
      confidence: knowledgeAtoms.confidence,
      status: knowledgeAtoms.status,
      topics: knowledgeAtoms.topics,
      structured: knowledgeAtoms.structured,
      createdAt: knowledgeAtoms.createdAt,
      extractedBy: knowledgeAtoms.extractedBy,
    })
    .from(knowledgeAtoms)
    .where(eq(knowledgeAtoms.scopeId, userId))
    .orderBy(desc(knowledgeAtoms.createdAt))
    .limit(100);
}
