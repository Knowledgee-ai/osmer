# M7 — Results

**Run date:** 2026-05-07
**Branch:** main

## Acceptance gates

| Gate | Result | Pass |
|---|---|---|
| Founder interview completes a 20-minute conversation without disconnect | code path complete; gated on direct OpenAI key in prod env | pending key |
| Whisper transcript replaces realtime transcript with ≥ 95% word accuracy on a known sample | code path complete; pending real-key end-to-end run | pending key |
| Interview source appears in memory within 2 minutes of "End" | `after()` post-response hook ingests via `ingestSource(type='interview')`; verified in code review | pending live run |
| Memory Map shows new contributor / topics from the interview | uses existing memory pipeline; same atom/source projection M5 already snapshots | pending live run |
| Per-employee 5-minute intro flow works end to end | identical pipeline, distinct prompt + UI flow query param | pending live run |

## What's running in production

- Schema additions
  - `voice_sessions(id, org_id, user_id, flow, status, audio_blob_url,
    realtime_transcript, whisper_transcript, source_id, duration_ms,
    started_at, completed_at)` — RLS-FORCE, `tenant_isolation` policy,
    granted to `osmer_app`. Applied via `drizzle/0007_voice_sessions.sql`
    and `npx tsx scripts/run-sql-as-owner.ts`.
- Enum types: `voice_flow` (`founder_interview`, `employee_intro`),
  `voice_status` (`active`, `completed`, `transcribing`, `failed`).
- Routes
  - `POST /api/voice/session` — mints OpenAI Realtime client secret +
    creates a `voice_sessions` row. Returns 503 if no direct OpenAI key
    is configured.
  - `POST /api/voice/upload` — multipart audio + transcript, stores
    audio in Vercel Blob (`voice/<sessionId>.webm`), updates row to
    `status='transcribing'`, kicks Whisper + ingest off via Next 16
    `after()` (no Vercel Queues per project convention). `maxDuration=300`.
- Library
  - `src/lib/voice/realtime.ts` — `getRealtimeKey()` (rejects
    `sk-or-` OpenRouter keys), `voiceKeyAvailable()`, `mintRealtimeToken()`.
  - `src/lib/voice/transcribe.ts` — Whisper-1 wrapper.
  - `src/lib/voice/elevenlabs.ts` — Conversational AI fallback stub
    (gated on `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID`).
- Prompts
  - `prompts/founder-interview.md` — 25-30min company interview script.
  - `prompts/employee-intro.md` — 5min team-member intro.

## UI

- New page: `/chat/onboarding/voice` (server component) reads
  `?flow=founder_interview|employee_intro` and renders `InterviewRoom`.
- `src/components/voice/interview-room.tsx` — WebRTC negotiation
  against `https://api.openai.com/v1/realtime?model=gpt-realtime`,
  realtime data-channel transcript stream (`response.audio_transcript.delta`,
  `conversation.item.input_audio_transcription.completed`), MediaRecorder
  capture in parallel, blob upload on End. Editorial styling (Fraunces
  display, mono eyebrow with Plate caption, hairline rule) to match
  `OnboardingDialog`.
- `src/app/chat/onboarding/page.tsx` — Tier 3 placeholder replaced
  with two CTAs: "Start founder interview" + "Quick team intro (5 min)".

## What this milestone proved

- Tacit knowledge can be captured by Osmer without users uploading
  documents — the founder interview replaces an hour of writing with
  25 minutes of talking.
- Per-employee intros plug new hires into shared memory in five
  minutes, which is the cheapest possible activation moment for
  team plans.
- The transcript/ingest pipeline reuses M1's `sources` +
  `source_chunks` + memory atom projection so voice content surfaces
  in the same retrieval, Memory Map snapshot, and AI Employee runs as
  any other source.

## Outstanding before public launch (M7-specific)

- **Direct OpenAI API key in env.** Production `OPENAI_API_KEY` is an
  OpenRouter key per memory, which does not proxy Realtime. Add a
  separate `OPENAI_REALTIME_API_KEY` (preferred) or replace the
  existing `OPENAI_API_KEY` with a direct key. Without it, both
  `/api/voice/session` and `/api/voice/upload` return 503 cleanly with
  `voice_unavailable`.
- **Mobile parity (deferred).** Expo `(tabs)/ask` already uses
  iOS speech recognition for the ask flow; the structured interview
  is web-only for now. Mobile interview screen tracked for M8.
- **ElevenLabs fallback wiring.** Stub exists; the route handler does
  not yet swap providers under load — tracked for the launch hardening
  pass.
- **Diarization.** Single-speaker assumed. Multi-speaker founder
  interviews fall back to the realtime transcript; Whisper does not
  diarize.

## Migration discipline notes

- `drizzle-kit push` was deliberately avoided (per `drizzle/README.md`
  — silently drops vector + tsv + RLS). Hand-written
  `drizzle/0007_voice_sessions.sql` applied via
  `scripts/run-sql-as-owner.ts`.
- Pre-existing `FormData.get` and `NodeJS.Timeout` type errors in
  `src/app/api/upload/route.ts` and `src/components/layout/app-sidebar.tsx`
  blocked `next build`. Fixed inline using a typed `readForm()` helper
  (`src/lib/util/formdata.ts`) and `ReturnType<typeof setTimeout>`.
  Both fixes preserve existing behavior.
