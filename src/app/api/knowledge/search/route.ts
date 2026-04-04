import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { query, limit = 10 } = await req.json() as {
    query: string;
    limit?: number;
  };

  // For now, return empty — knowledge search happens client-side
  // When DB is connected, this will do vector search server-side
  return Response.json({ atoms: [] });
}
