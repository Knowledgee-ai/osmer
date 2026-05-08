'use client';

import { useEffect, useRef, useState } from 'react';

type Flow = 'founder_interview' | 'employee_intro';
type Status = 'idle' | 'connecting' | 'live' | 'saving' | 'complete' | 'error';

interface Line {
  speaker: 'interviewer' | 'you';
  text: string;
}

const COPY: Record<Flow, { eyebrow: string; plate: string; title: string; subtitle: string }> = {
  founder_interview: {
    eyebrow: '§ Interview · Founder',
    plate: 'Plate VII',
    title: 'A conversation with your company.',
    subtitle: 'About 25 minutes. Speak naturally — Osmer will probe for specifics. The transcript becomes the seed for your AI Employees.',
  },
  employee_intro: {
    eyebrow: '§ Interview · Team',
    plate: 'Plate VII · b',
    title: 'A five-minute intro.',
    subtitle: 'Quick conversation. Your role, what you own, who you work with. Goes into the team’s shared memory.',
  },
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function InterviewRoom({ flow }: { flow: Flow }) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [lines, setLines] = useState<Line[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentDeltaRef = useRef<string>('');

  function appendLine(line: Line) {
    setLines((s) => [...s, line]);
  }

  function flushAssistantDelta() {
    const text = currentDeltaRef.current.trim();
    currentDeltaRef.current = '';
    if (text) appendLine({ speaker: 'interviewer', text });
  }

  async function start() {
    setErrorMsg('');
    setLines([]);
    setStatus('connecting');

    try {
      const r = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow }),
      });
      if (r.status === 503) {
        const j = await r.json().catch(() => ({}));
        setErrorMsg(j.message ?? 'Voice is not available yet.');
        setStatus('error');
        return;
      }
      if (!r.ok) {
        setErrorMsg(`session ${r.status}`);
        setStatus('error');
        return;
      }
      const { voiceSessionId, clientSecret } = (await r.json()) as { voiceSessionId: string; clientSecret: string };
      sessionIdRef.current = voiceSessionId;

      const pc = new RTCPeerConnection();
      peerRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;

      pc.ontrack = (e) => {
        const a = new Audio();
        a.srcObject = e.streams[0];
        a.autoplay = true;
        a.play().catch((err) => console.warn('audio playback failed', err));
      };

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === 'response.audio_transcript.delta' && typeof m.delta === 'string') {
            currentDeltaRef.current += m.delta;
          } else if (m.type === 'response.audio_transcript.done' || m.type === 'response.done') {
            flushAssistantDelta();
          } else if (
            m.type === 'conversation.item.input_audio_transcription.completed' &&
            typeof m.transcript === 'string'
          ) {
            const text = m.transcript.trim();
            if (text) appendLine({ speaker: 'you', text });
          }
        } catch {
          // non-JSON event, ignore
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch('https://api.openai.com/v1/realtime?model=gpt-realtime', {
        method: 'POST',
        headers: { 'content-type': 'application/sdp', authorization: `Bearer ${clientSecret}` },
        body: offer.sdp,
      });
      if (!sdpResp.ok) throw new Error(`realtime sdp ${sdpResp.status}`);
      const answer = { type: 'answer', sdp: await sdpResp.text() } as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(answer);

      startedAtRef.current = Date.now();
      tickerRef.current = setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 500);

      setStatus('live');
    } catch (err) {
      console.error('[voice] start failed', err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
      cleanup();
    }
  }

  function cleanup() {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    try {
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    } catch {}
    try {
      peerRef.current?.close();
    } catch {}
    try {
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
  }

  async function stop() {
    setStatus('saving');
    flushAssistantDelta();

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    await new Promise((r) => setTimeout(r, 250));

    cleanup();

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const transcriptText = lines
      .map((l) => `[${l.speaker === 'interviewer' ? 'Interviewer' : 'You'}] ${l.text}`)
      .join('\n');

    try {
      const fd = new FormData();
      fd.append('audio', blob, 'interview.webm');
      fd.append('voiceSessionId', sessionIdRef.current ?? '');
      fd.append('realtimeTranscript', transcriptText);
      fd.append('durationMs', String(Date.now() - startedAtRef.current));
      const r = await fetch('/api/voice/upload', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`upload ${r.status}`);
      setStatus('complete');
    } catch (err) {
      console.error('[voice] upload failed', err);
      setErrorMsg('We saved the conversation locally but the upload failed. Try again in a moment.');
      setStatus('error');
    }
  }

  useEffect(() => () => cleanup(), []);

  const copy = COPY[flow];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="mono text-stone-500">{copy.eyebrow}</span>
          <span className="mono text-stone-400">{copy.plate}</span>
        </div>
        <h1 className="font-serif text-[2.25rem] leading-[1.05] tracking-tight">
          {copy.title}
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md">{copy.subtitle}</p>
      </header>

      <div className="border-t border-stone-200 dark:border-stone-800" />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="mono text-stone-500">
            {status === 'idle' && 'Ready'}
            {status === 'connecting' && 'Connecting'}
            {status === 'live' && 'Live'}
            {status === 'saving' && 'Saving'}
            {status === 'complete' && 'Saved'}
            {status === 'error' && 'Error'}
          </span>
          {(status === 'live' || status === 'saving' || status === 'complete') && (
            <span className="mono text-stone-400">{formatElapsed(elapsed)}</span>
          )}
        </div>

        <div className="rounded-sm border border-stone-200 dark:border-stone-800 min-h-[260px] p-6 text-[0.95rem] leading-relaxed whitespace-pre-wrap">
          {status === 'idle' && (
            <span className="text-stone-500 italic font-serif">
              Press Begin when you&rsquo;re in a quiet room. Osmer will introduce itself and ask the first question.
            </span>
          )}
          {status === 'connecting' && (
            <span className="text-stone-500 mono">Negotiating connection…</span>
          )}
          {(status === 'live' || status === 'saving' || status === 'complete') && lines.length === 0 && (
            <span className="text-stone-500 italic font-serif">Listening…</span>
          )}
          {lines.length > 0 && (
            <div className="space-y-4">
              {lines.map((l, i) => (
                <div key={i} className="space-y-1">
                  <div className="mono text-stone-400">
                    {l.speaker === 'interviewer' ? 'Interviewer' : 'You'}
                  </div>
                  <div className={l.speaker === 'interviewer' ? 'font-serif' : ''}>{l.text}</div>
                </div>
              ))}
            </div>
          )}
          {status === 'error' && errorMsg && (
            <div className="text-red-700 dark:text-red-400 mono text-xs">{errorMsg}</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-stone-500">
            {status === 'idle' && 'Audio is captured locally. The full recording uploads only after you end.'}
            {status === 'live' && 'You can end the conversation at any time.'}
            {status === 'saving' && 'Uploading audio for high-fidelity transcription…'}
            {status === 'complete' && 'Your interview is in memory. Refresh the home page to see it surface.'}
          </p>
          <div className="flex gap-2 shrink-0">
            {(status === 'idle' || status === 'error') && (
              <button
                onClick={start}
                className="rounded-sm bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-5 py-2 text-sm font-medium hover:opacity-90 transition"
              >
                Begin
              </button>
            )}
            {status === 'live' && (
              <button
                onClick={stop}
                className="rounded-sm border border-stone-900 dark:border-stone-100 px-5 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-900 transition"
              >
                End
              </button>
            )}
            {status === 'complete' && (
              <a
                href="/chat"
                className="rounded-sm bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-5 py-2 text-sm font-medium hover:opacity-90 transition"
              >
                Done
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
