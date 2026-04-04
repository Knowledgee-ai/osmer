import { auth } from '@/lib/auth';
import { searchKnowledgeByVector } from '@/lib/knowledge/db-store';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ atoms: [] });
  }

  const { query, limit = 8 } = await req.json() as {
    query: string;
    limit?: number;
  };

  const atoms = await searchKnowledgeByVector(query, session.user.id, limit);

  return Response.json({
    atoms: atoms.map((a) => ({
      ...a,
      // Only return atoms with decent relevance
    })).filter((a) => a.similarity > 0.3),
  });
}
