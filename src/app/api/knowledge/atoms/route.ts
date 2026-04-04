import { auth } from '@/lib/auth';
import { getAllKnowledgeAtoms } from '@/lib/knowledge/db-store';

// GET /api/knowledge/atoms — list user's knowledge atoms
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ atoms: [] });
  }

  const atoms = await getAllKnowledgeAtoms(session.user.id);

  return Response.json({
    atoms: atoms.map((a) => ({
      id: a.id,
      type: a.type,
      content: a.content,
      confidence: a.confidence,
      status: a.status,
      topics: a.topics || [],
      entities: (a.structured as { entities?: string[] })?.entities || [],
      extractedBy: a.extractedBy,
      createdAt: a.createdAt,
    })),
  });
}
