import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { voiceSessions, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { after } from 'next/server';
import { transcribeWithWhisper } from '@/lib/voice/transcribe';
import { ingestSource } from '@/lib/memory/ingest';
import { chunkText } from '@/lib/memory/chunker';
import { withTenant } from '@/lib/db/tenant';
import { readForm } from '@/lib/util/formdata';

export const maxDuration = 300;

/**
 * POST /api/voice/upload
 *
 * Multipart body: audio (File), voiceSessionId, realtimeTranscript,
 * durationMs.
 *
 * Stores the recorded audio in Vercel Blob, marks the voice_sessions
 * row as transcribing, returns immediately, and uses Next 16 `after()`
 * to run Whisper + ingest as a fire-and-forget post-response task.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const [me] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const fd = await readForm(req);
  const audio = fd.get('audio');
  const voiceSessionId = String(fd.get('voiceSessionId') ?? '');
  const realtimeTranscript = String(fd.get('realtimeTranscript') ?? '');
  const durationMs = Number(fd.get('durationMs') ?? 0) || null;

  if (!(audio instanceof File) || !voiceSessionId) {
    return Response.json({ error: 'audio + voiceSessionId required' }, { status: 400 });
  }

  const orgId = me.orgId;
  const userId = session.user.id;
  const buf = Buffer.from(await audio.arrayBuffer());

  const { url } = await put(`voice/${voiceSessionId}.webm`, buf, {
    access: 'public',
    contentType: 'audio/webm',
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await withTenant(orgId, (tx) =>
    tx
      .update(voiceSessions)
      .set({
        audioBlobUrl: url,
        realtimeTranscript,
        durationMs,
        status: 'transcribing',
        completedAt: new Date(),
      })
      .where(eq(voiceSessions.id, voiceSessionId)),
  );

  after(() => finalizeVoiceSession(orgId, userId, voiceSessionId, realtimeTranscript));

  return Response.json({ ok: true, audioBlobUrl: url });
}

async function finalizeVoiceSession(
  orgId: string,
  userId: string,
  voiceSessionId: string,
  fallbackTranscript: string,
) {
  try {
    const [vs] = await withTenant(orgId, (tx) =>
      tx.select().from(voiceSessions).where(eq(voiceSessions.id, voiceSessionId)),
    );
    if (!vs?.audioBlobUrl) {
      console.warn('[voice/finalize] no audio url for', voiceSessionId);
      return;
    }

    let text = '';
    try {
      text = await transcribeWithWhisper(vs.audioBlobUrl);
    } catch (err) {
      console.warn('[voice/finalize] whisper failed, falling back to realtime transcript', err);
      text = fallbackTranscript;
    }

    if (!text.trim()) {
      await withTenant(orgId, (tx) =>
        tx.update(voiceSessions).set({ status: 'failed' }).where(eq(voiceSessions.id, voiceSessionId)),
      );
      return;
    }

    const title = vs.flow === 'founder_interview' ? 'Founder interview' : 'Employee intro';
    const sourceId = await ingestSource({
      orgId,
      type: 'interview',
      ownerUserId: userId,
      title,
      chunks: chunkText(text).map((c) => ({ ord: c.ord, content: c.content })),
      meta: {
        voiceSessionId,
        flow: vs.flow,
        audioBlobUrl: vs.audioBlobUrl,
        durationMs: vs.durationMs ?? null,
      },
    });

    await withTenant(orgId, (tx) =>
      tx
        .update(voiceSessions)
        .set({ whisperTranscript: text, sourceId, status: 'completed' })
        .where(eq(voiceSessions.id, voiceSessionId)),
    );
  } catch (err) {
    console.error('[voice/finalize] failed', err);
    try {
      await withTenant(orgId, (tx) =>
        tx.update(voiceSessions).set({ status: 'failed' }).where(eq(voiceSessions.id, voiceSessionId)),
      );
    } catch {
      // best-effort
    }
  }
}
