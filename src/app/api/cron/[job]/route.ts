import { runAffirmation } from '@/lib/memory/cron/affirmation';
import { runDrift } from '@/lib/memory/cron/drift';
import { runDisagreement } from '@/lib/memory/cron/disagreement';
import { runConsolidation } from '@/lib/memory/cron/consolidation';
import { runHealth } from '@/lib/memory/cron/health';
import { runMonitor } from '@/lib/agent/cron/monitor';
import { runMemoryMapSnapshot } from '@/lib/memory-map/cron';

export const maxDuration = 300;

const HANDLERS: Record<string, () => Promise<unknown>> = {
  affirmation: runAffirmation,
  drift: runDrift,
  disagreement: runDisagreement,
  consolidation: runConsolidation,
  health: runHealth,
  monitor: runMonitor,
  'memory-map': runMemoryMapSnapshot,
};

function isAuthorized(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ job: string }> }) {
  if (!isAuthorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { job } = await ctx.params;
  const handler = HANDLERS[job];
  if (!handler) return Response.json({ error: 'unknown job' }, { status: 404 });
  const out = await handler();
  return Response.json({ job, out });
}
