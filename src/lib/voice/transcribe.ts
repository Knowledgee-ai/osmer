import { getRealtimeKey } from './realtime';

/**
 * Whisper-1 offline transcription. Used to produce the gold transcript
 * from the recorded audio after a Realtime conversation ends. Uses the
 * same direct OpenAI key as Realtime (OpenRouter does not proxy this
 * endpoint reliably either).
 */
export async function transcribeWithWhisper(audioUrl: string): Promise<string> {
  const apiKey = getRealtimeKey();
  if (!apiKey) throw new Error('voice_unavailable: direct OpenAI API key required for Whisper');

  const audio = await fetch(audioUrl);
  if (!audio.ok) throw new Error(`fetch audio failed: ${audio.status}`);
  const buf = await audio.arrayBuffer();

  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'audio/webm' }), 'audio.webm');
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'text');

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`whisper failed: ${r.status} ${await r.text()}`);

  return (await r.text()).trim();
}
