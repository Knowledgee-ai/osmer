import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, voiceSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mintRealtimeToken, voiceKeyAvailable } from '@/lib/voice/realtime';
import { withTenant } from '@/lib/db/tenant';

/**
 * POST /api/voice/session
 *
 * Body: { flow: 'founder_interview' | 'employee_intro' }
 *
 * Mints an OpenAI Realtime client secret + creates a voice_sessions
 * row. The client uses the secret to open a WebRTC connection
 * directly to OpenAI; the row tracks state until upload + Whisper
 * finalize lands the verbatim transcript in memory.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });

  if (!voiceKeyAvailable()) {
    return Response.json(
      {
        error: 'voice_unavailable',
        message:
          'Voice onboarding requires a direct OpenAI API key. Set OPENAI_REALTIME_API_KEY (or OPENAI_API_KEY when not using OpenRouter) in the environment.',
      },
      { status: 503 },
    );
  }

  const [me] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { flow?: string };
  const flow = body.flow === 'employee_intro' ? 'employee_intro' : 'founder_interview';
  const promptFile = flow === 'founder_interview' ? 'founder-interview.md' : 'employee-intro.md';

  let systemPrompt: string;
  try {
    systemPrompt = await fs.readFile(path.resolve(process.cwd(), 'prompts', promptFile), 'utf8');
  } catch (err) {
    console.error('[voice] prompt read failed', err);
    return Response.json({ error: 'prompt_unavailable' }, { status: 500 });
  }

  const userId = session.user.id;
  const orgId = me.orgId;

  const [vs] = await withTenant(orgId, (tx) =>
    tx
      .insert(voiceSessions)
      .values({ orgId, userId, flow })
      .returning({ id: voiceSessions.id }),
  );

  const tok = await mintRealtimeToken(systemPrompt);
  return Response.json({ voiceSessionId: vs.id, clientSecret: tok.clientSecret });
}
