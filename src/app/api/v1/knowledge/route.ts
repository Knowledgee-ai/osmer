import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { searchKnowledgeByVector, saveKnowledgeAtomToDb } from '@/lib/knowledge/db-store';

// External API for programmatic knowledge access
// Auth via Bearer token (API key stored in user preferences)

async function authenticateApiKey(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const apiKey = authHeader.slice(7);
  const result = await db.execute(
    sql`SELECT id FROM users WHERE preferences->>'externalApiKey' = ${apiKey} LIMIT 1`
  );

  return result.rows.length > 0 ? (result.rows[0] as { id: string }).id : null;
}

// GET /api/v1/knowledge — list or search knowledge atoms
export async function GET(req: Request) {
  const userId = await authenticateApiKey(req);
  if (!userId) {
    return Response.json({ error: "Invalid API key. Set your key in Settings." }, { status: 401 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50);

  if (query) {
    // Semantic search
    const results = await searchKnowledgeByVector(query, userId, limit);
    return Response.json({ atoms: results, query });
  }

  // List all
  const result = await db.execute(
    sql`SELECT id, type, scope, content, confidence, status, topics, created_at
      FROM knowledge_atoms WHERE scope_id = ${userId} AND status = 'active'
      ORDER BY created_at DESC LIMIT ${limit}`
  );

  return Response.json({ atoms: result.rows });
}

// POST /api/v1/knowledge — create a knowledge atom programmatically
export async function POST(req: Request) {
  const userId = await authenticateApiKey(req);
  if (!userId) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  const { type, content, confidence, topics, entities } = await req.json() as {
    type: string;
    content: string;
    confidence?: number;
    topics?: string[];
    entities?: string[];
  };

  if (!type || !content) {
    return Response.json({ error: "type and content are required" }, { status: 400 });
  }

  const result = await saveKnowledgeAtomToDb({
    type,
    content,
    confidence: confidence || 0.8,
    topics: topics || [],
    entities: entities || [],
    sourceConversationId: 'external-api',
    extractedBy: 'external-api',
    userId,
  });

  return Response.json({ atom: result });
}
