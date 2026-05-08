/**
 * OpenAI Realtime API helpers.
 *
 * Realtime requires a *direct* OpenAI API key. OpenRouter does not
 * proxy Realtime, so a key starting with `sk-or-` will not work even
 * if the rest of the app uses OpenRouter for chat completions.
 *
 * Prefers OPENAI_REALTIME_API_KEY when set, otherwise falls back to
 * OPENAI_API_KEY. `voiceKeyAvailable()` returns false when neither is
 * usable so the route handler can return a clean 503.
 */

const OPENROUTER_PREFIX = 'sk-or-';

export function getRealtimeKey(): string | null {
  const candidates = [process.env.OPENAI_REALTIME_API_KEY, process.env.OPENAI_API_KEY];
  for (const k of candidates) {
    if (!k) continue;
    if (k.startsWith(OPENROUTER_PREFIX)) continue;
    return k;
  }
  return null;
}

export function voiceKeyAvailable(): boolean {
  return getRealtimeKey() !== null;
}

export interface RealtimeToken {
  clientSecret: string;
  sessionId: string;
}

export async function mintRealtimeToken(systemPrompt: string, voice = 'alloy'): Promise<RealtimeToken> {
  const apiKey = getRealtimeKey();
  if (!apiKey) throw new Error('voice_unavailable: direct OpenAI API key required');

  const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-realtime',
      voice,
      instructions: systemPrompt,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      turn_detection: { type: 'server_vad' },
    }),
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`realtime session failed: ${r.status} ${body}`);
  }

  const j = (await r.json()) as { id: string; client_secret: { value: string } };
  return { clientSecret: j.client_secret.value, sessionId: j.id };
}
