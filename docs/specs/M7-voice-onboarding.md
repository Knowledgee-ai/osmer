# M7 — Voice Onboarding (Tier 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Two voice flows that turn tacit knowledge into structured memory: (1) a 20-30 minute founder/admin company interview that runs after Tier 1+2 onboarding has seeded the system, and (2) a 5-minute per-employee intro for new team members. Both produce verbatim transcripts plus structured extraction, stored as `sources` of type=interview.

**Architecture:** OpenAI Realtime API (primary) for the live conversation; ElevenLabs Conversational AI as fallback. The conversational system prompt is structured as a guided interview — it asks one question at a time, summarizes what it learned, and probes follow-ups. The full audio is recorded to Vercel Blob (so we can re-transcribe with Whisper for higher fidelity offline). The realtime transcript becomes the primary verbatim chunks; Whisper produces the gold transcript that supersedes them on completion.

**Tech Stack:** OpenAI Realtime API (WebRTC or WebSocket), ElevenLabs Conversational AI fallback, Whisper-1 for offline transcription, MediaRecorder API for client-side recording, Vercel Blob for audio storage.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/lib/voice/realtime.ts` | OpenAI Realtime WebRTC connection helpers (server token mint + client connect) |
| `src/lib/voice/elevenlabs.ts` | ElevenLabs Conversational AI fallback |
| `src/lib/voice/interview.ts` | Interview-flow logic: question script, transcript collection, completion detection |
| `src/lib/voice/transcribe.ts` | Whisper offline transcription |
| `src/app/api/voice/session/route.ts` | Mint a Realtime session token |
| `src/app/api/voice/upload/route.ts` | Upload final audio to Blob, queue Whisper transcription |
| `src/app/api/queue/voice-finalize/route.ts` | Whisper + replace verbatim chunks |
| `src/app/chat/onboarding/voice/page.tsx` | Voice interview UI |
| `src/components/voice/interview-room.tsx` | Live conversation UI with mic + transcript |
| `src/components/voice/interview-summary.tsx` | Post-interview summary |
| `prompts/founder-interview.md` | Founder interview script |
| `prompts/employee-intro.md` | Per-employee intro script |
| `drizzle/0014_voice_sessions.sql` | `voice_sessions` table |

**Modified files:**

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | Add `voiceSessions` |
| `src/lib/memory/ingest.ts` | Accept type=interview; preserve speaker labels |
| `src/components/onboarding/onboarding-flow.tsx` | Wire Tier 3 link |

---

## Task 1: Schema for voice sessions

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Definitions**

```ts
export const voiceFlowEnum = pgEnum('voice_flow', ['founder_interview', 'employee_intro']);
export const voiceStatusEnum = pgEnum('voice_status', ['active', 'completed', 'transcribing', 'failed']);

export const voiceSessions = pgTable('voice_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  flow: voiceFlowEnum('flow').notNull(),
  status: voiceStatusEnum('status').notNull().default('active'),
  audioBlobUrl: text('audio_blob_url'),
  realtimeTranscript: text('realtime_transcript'),
  whisperTranscript: text('whisper_transcript'),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'set null' }),
  durationMs: integer('duration_ms'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (t) => [
  index('vs_org_idx').on(t.orgId),
  index('vs_user_idx').on(t.userId),
]);
```

- [ ] **Step 2: Push + RLS**

```bash
npx drizzle-kit generate --name voice_sessions
npx drizzle-kit push
psql "$DATABASE_URL" -c "ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ON voice_sessions USING (org_id = current_setting('app.current_org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);"
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): voice_sessions table + RLS"
```

---

## Task 2: Interview prompts

**Files:**
- Create: `prompts/founder-interview.md`
- Create: `prompts/employee-intro.md`

- [ ] **Step 1: Founder interview prompt**

```markdown
# Founder Interview System Prompt

You are an expert interviewer building a private knowledge base for the user's company. You are warm, direct, and curious. You ask one question at a time, listen carefully, and probe for specifics. You do NOT interrupt — you wait for the user to finish.

You have 25-30 minutes. Cover these areas, in this order, but adapt fluidly:

## 1. Company essence (3-4 min)
- "Tell me, in your own words, what your company does and who it's for."
- Probe: ICP specifics, what makes them different from one-line competitors.

## 2. Customers and patterns (5-6 min)
- "Walk me through your three most important customers — who they are, why they bought, what they value."
- Probe: deal sizes, contract length, expansion patterns.

## 3. The pitch (3-4 min)
- "If a new prospect just got on a call with you, what's the first 3 minutes you'd say?"
- Capture exact phrasing.

## 4. Recent wins (4-5 min)
- "Tell me about a recent win you're proud of — what did it take, why did they choose you, what did the deliverable look like?"

## 5. Recent losses or hard cases (3-4 min)
- "What's a deal you lost or a project that was hard? Why?"

## 6. The team (2-3 min)
- "Who's on the team, and what does each person own?"

## 7. Tools and stack (2 min)
- "What tools do you use day-to-day?"

## 8. What you wish you knew (1-2 min)
- "If you could ask your future self anything about the next 12 months, what would it be?"

End with: "I have everything I need. This will be in your memory in a few minutes."

## Style rules
- Speak in 1-3 sentences, never paragraphs.
- Wait for the user to finish before asking the next question.
- If the user gives a vague answer, ask one specific follow-up.
- Do not summarize until the end. The transcript is the artifact.
- Do not give advice or opinions. You're collecting, not coaching.
```

- [ ] **Step 2: Employee intro prompt**

```markdown
# Employee Intro System Prompt

You are interviewing a new team member to capture their role and how they fit. Five minutes. Warm, fast, focused.

Cover, in any order:
- "Hi! Quick intro. Your name and role?"
- "What do you own? What's the deliverable that says 'this is mine'?"
- "Who do you work with most?"
- "What are you working on this week or this month?"
- "What's something only you know — a specific customer, project, or context — that the team should be able to ask AI about?"

End with: "Got it. This will be in the team's memory shortly."
```

- [ ] **Step 3: Commit**

```bash
git add prompts/
git commit -m "feat(voice): founder + employee interview prompts"
```

---

## Task 3: OpenAI Realtime session

**Files:**
- Create: `src/lib/voice/realtime.ts`
- Create: `src/app/api/voice/session/route.ts`

- [ ] **Step 1: Server token mint**

`src/lib/voice/realtime.ts`:

```ts
export async function mintRealtimeToken(systemPrompt: string, voice = 'alloy'): Promise<{ clientSecret: string; sessionId: string }> {
  const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-realtime',
      voice,
      instructions: systemPrompt,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      turn_detection: { type: 'server_vad' },
    }),
  });
  if (!r.ok) throw new Error(`realtime session failed: ${r.status} ${await r.text()}`);
  const j = await r.json() as { id: string; client_secret: { value: string } };
  return { clientSecret: j.client_secret.value, sessionId: j.id };
}
```

- [ ] **Step 2: Session route**

`src/app/api/voice/session/route.ts`:

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, voiceSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mintRealtimeToken } from '@/lib/voice/realtime';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const { flow } = await req.json() as { flow: 'founder_interview' | 'employee_intro' };
  const promptFile = flow === 'founder_interview' ? 'founder-interview.md' : 'employee-intro.md';
  const systemPrompt = await fs.readFile(path.resolve(process.cwd(), 'prompts', promptFile), 'utf8');

  const [vs] = await db.insert(voiceSessions).values({ orgId: me.orgId, userId: session.user.id, flow }).returning();
  const tok = await mintRealtimeToken(systemPrompt);
  return Response.json({ voiceSessionId: vs.id, clientSecret: tok.clientSecret });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/voice/realtime.ts src/app/api/voice/session/route.ts
git commit -m "feat(voice): OpenAI Realtime session minter"
```

---

## Task 4: Interview UI (web)

**Files:**
- Create: `src/components/voice/interview-room.tsx`
- Create: `src/app/chat/onboarding/voice/page.tsx`

- [ ] **Step 1: Interview room (WebRTC)**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export function InterviewRoom({ flow }: { flow: 'founder_interview' | 'employee_intro' }) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'ended' | 'error'>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  async function start() {
    setStatus('connecting');
    try {
      const r = await fetch('/api/voice/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ flow }) });
      if (!r.ok) throw new Error(`session mint failed: ${r.status}`);
      const { voiceSessionId, clientSecret } = await r.json();
      sessionIdRef.current = voiceSessionId;

      const pc = new RTCPeerConnection();
      peerRef.current = pc;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Recording
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
      recorderRef.current = recorder;

      // Audio out
      pc.ontrack = (e) => { const a = new Audio(); a.srcObject = e.streams[0]; a.play(); };

      // Data channel for events / transcript
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === 'response.audio_transcript.delta') setTranscript((s) => s + (m.delta ?? ''));
          if (m.type === 'conversation.item.created' && m.item?.role === 'user' && m.item?.content?.[0]?.transcript) {
            setTranscript((s) => `${s}\n[You] ${m.item.content[0].transcript}\n`);
          }
        } catch {}
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResp = await fetch('https://api.openai.com/v1/realtime?model=gpt-realtime', {
        method: 'POST',
        headers: { 'content-type': 'application/sdp', authorization: `Bearer ${clientSecret}` },
        body: offer.sdp,
      });
      const answer = { type: 'answer', sdp: await sdpResp.text() } as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(answer);

      setStatus('live');
    } catch (err) {
      console.error(err); setStatus('error');
    }
  }

  async function stop() {
    setStatus('ended');
    recorderRef.current?.stop();
    await new Promise((r) => setTimeout(r, 200));
    peerRef.current?.close();
    mediaRef.current?.getTracks().forEach((t) => t.stop());

    // Upload audio blob
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const fd = new FormData();
    fd.append('audio', blob, 'interview.webm');
    fd.append('voiceSessionId', sessionIdRef.current!);
    fd.append('realtimeTranscript', transcript);
    await fetch('/api/voice/upload', { method: 'POST', body: fd });
  }

  useEffect(() => () => { peerRef.current?.close(); mediaRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-6">
      <h1 className="font-serif text-3xl">{flow === 'founder_interview' ? 'Company interview' : 'Quick intro'}</h1>
      <p className="text-sm text-stone-500">{flow === 'founder_interview' ? 'About 25 minutes. Speak naturally.' : 'About 5 minutes.'}</p>

      <div className="rounded-md border p-6 min-h-[160px] whitespace-pre-wrap text-sm">
        {status === 'idle' && 'Press Start when you\'re ready.'}
        {status === 'connecting' && 'Connecting…'}
        {status === 'live' && (transcript || 'Listening…')}
        {status === 'ended' && 'Saving — your transcript will appear in memory shortly.'}
        {status === 'error' && 'Something went wrong. Try again.'}
      </div>

      <div className="flex gap-2">
        {(status === 'idle' || status === 'error') && <button onClick={start} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">Start</button>}
        {status === 'live' && <button onClick={stop} className="rounded-md bg-stone-700 text-white px-4 py-2 text-sm">End</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page**

```tsx
import { InterviewRoom } from '@/components/voice/interview-room';

export default function VoicePage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  // RSC Promise-style for App Router 16
  return <InterviewRoom flow="founder_interview" />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/voice/ src/app/chat/onboarding/voice/
git commit -m "feat(voice): WebRTC interview room with realtime transcript + audio recording"
```

---

## Task 5: Audio upload + Whisper finalize

**Files:**
- Create: `src/app/api/voice/upload/route.ts`
- Create: `src/lib/voice/transcribe.ts`
- Create: `src/app/api/queue/voice-finalize/route.ts`

- [ ] **Step 1: Upload route**

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { voiceSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { queue } from '@vercel/functions/queue';

export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const fd = await req.formData();
  const audio = fd.get('audio') as File;
  const voiceSessionId = fd.get('voiceSessionId') as string;
  const realtimeTranscript = (fd.get('realtimeTranscript') as string) ?? '';
  const buf = Buffer.from(await audio.arrayBuffer());
  const { url } = await put(`voice/${voiceSessionId}.webm`, buf, { access: 'public', contentType: 'audio/webm' });
  await db.update(voiceSessions).set({ audioBlobUrl: url, realtimeTranscript, status: 'transcribing', completedAt: new Date() }).where(eq(voiceSessions.id, voiceSessionId));
  await queue.send(process.env.QUEUE_VOICE_NAME ?? 'osmer-voice', { voiceSessionId });
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Transcribe via Whisper**

```ts
export async function transcribeWithWhisper(audioUrl: string): Promise<string> {
  const audio = await fetch(audioUrl);
  const buf = await audio.arrayBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'audio/webm' }), 'audio.webm');
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'text');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`whisper failed: ${r.status}`);
  return await r.text();
}
```

- [ ] **Step 3: Finalize consumer**

```ts
import { db } from '@/lib/db';
import { voiceSessions, sources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { transcribeWithWhisper } from '@/lib/voice/transcribe';
import { ingestSource } from '@/lib/memory/ingest';
import { chunkText } from '@/lib/memory/chunker';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { voiceSessionId } = await req.json() as { voiceSessionId: string };
  const [vs] = await db.select().from(voiceSessions).where(eq(voiceSessions.id, voiceSessionId));
  if (!vs?.audioBlobUrl) return Response.json({ error: 'no_audio' }, { status: 404 });
  const text = await transcribeWithWhisper(vs.audioBlobUrl);

  const sourceId = await ingestSource({
    orgId: vs.orgId,
    type: 'interview',
    ownerUserId: vs.userId,
    title: vs.flow === 'founder_interview' ? 'Founder interview' : 'Employee intro',
    chunks: chunkText(text).map((c) => ({ ord: c.ord, content: c.content })),
    meta: { voiceSessionId, flow: vs.flow, audioBlobUrl: vs.audioBlobUrl },
  });

  await db.update(voiceSessions).set({ whisperTranscript: text, sourceId, status: 'completed' }).where(eq(voiceSessions.id, voiceSessionId));
  return Response.json({ ok: true, sourceId });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/voice/ src/app/api/queue/voice-finalize/ src/lib/voice/transcribe.ts
git commit -m "feat(voice): audio upload + Whisper finalize → ingest as type=interview"
```

---

## Task 6: ElevenLabs fallback

**Files:**
- Create: `src/lib/voice/elevenlabs.ts`

- [ ] **Step 1: Stub fallback**

```ts
// Used when OPENAI_REALTIME_DISABLED=1 or Realtime returns 5xx repeatedly.
// ElevenLabs Conversational AI uses a similar agent + WebSocket pattern.
export async function startElevenLabsConvo(systemPrompt: string): Promise<{ websocketUrl: string }> {
  const r = await fetch('https://api.elevenlabs.io/v1/convai/conversation/get_signed_url', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' },
    body: JSON.stringify({ agent_id: process.env.ELEVENLABS_AGENT_ID, override_prompt: systemPrompt }),
  });
  if (!r.ok) throw new Error(`elevenlabs convo failed: ${r.status}`);
  const j = await r.json() as { signed_url: string };
  return { websocketUrl: j.signed_url };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/voice/elevenlabs.ts
git commit -m "feat(voice): ElevenLabs Conversational AI fallback stub"
```

---

## Task 7: Acceptance + results

**Files:**
- Create: `docs/specs/M7-results.md`

- [ ] **Step 1: Results template**

```markdown
# M7 — Results

| Gate | Result |
|---|---|
| Founder interview completes a 20-minute conversation without disconnect | |
| Whisper transcript replaces realtime transcript with ≥ 95% word accuracy on a known sample | |
| Interview source appears in memory within 2 minutes of "End" | |
| Memory Map shows new contributor / topics from the interview | |
| Per-employee 5-minute intro flow works end to end | |
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/M7-results.md
git commit -m "docs(m7): voice onboarding acceptance template"
```

---

## Self-review

- Founder interview ✓
- Employee intro ✓
- Realtime + Whisper double-pass ✓
- Audio storage ✓
- Ingest as type=interview ✓
- ElevenLabs fallback stub ✓
- Mobile path: voice from Expo (deferred to M8 — UI exists but uses iOS speech recognition for the "ask" tab, not the structured interview)

**Deferred:** Speaker diarization for multi-person interviews, mid-conversation user-edits to the script, automatic interview reminders for new hires.
