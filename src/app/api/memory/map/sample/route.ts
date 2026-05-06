import sample from '@/lib/memory-map/sample.json';

/**
 * Returns a synthetic Memory Map snapshot for unauthed visitors
 * (used by the marketing landing's 3D hero). No real data leaks here.
 */
export async function GET() {
  return Response.json(sample);
}
