/**
 * ElevenLabs Conversational AI fallback. Activated when OpenAI Realtime
 * is unavailable (no direct key, repeated 5xx, or VOICE_PROVIDER=elevenlabs).
 *
 * Returns a signed websocket URL the client opens to drive the same
 * agent + WebSocket pattern as Realtime. Requires ELEVENLABS_API_KEY +
 * ELEVENLABS_AGENT_ID configured per env.
 */

export interface ElevenLabsSession {
  websocketUrl: string;
}

export function elevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_AGENT_ID;
}

export async function startElevenLabsConvo(systemPrompt: string): Promise<ElevenLabsSession> {
  if (!elevenLabsConfigured()) {
    throw new Error('voice_unavailable: ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID required');
  }

  const r = await fetch('https://api.elevenlabs.io/v1/convai/conversation/get_signed_url', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
    },
    body: JSON.stringify({
      agent_id: process.env.ELEVENLABS_AGENT_ID,
      override_prompt: systemPrompt,
    }),
  });

  if (!r.ok) throw new Error(`elevenlabs convo failed: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { signed_url: string };
  return { websocketUrl: j.signed_url };
}
