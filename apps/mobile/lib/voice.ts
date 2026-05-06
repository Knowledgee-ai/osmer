import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

interface StartOpts {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (msg: string) => void;
}

/**
 * Begin a one-shot speech recognition session. Returns a stop()
 * cleanup that ends the session and removes listeners. Idempotent.
 */
export async function startListening(opts: StartOpts): Promise<() => void> {
  const sub = ExpoSpeechRecognitionModule.addListener('result', (e: { results?: Array<{ transcript: string }>; isFinal?: boolean }) => {
    const transcript = e.results?.[0]?.transcript ?? '';
    opts.onTranscript(transcript, !!e.isFinal);
  });
  const errSub = ExpoSpeechRecognitionModule.addListener('error', (e: { message?: string }) => {
    opts.onError?.(e.message ?? 'speech recognition failed');
  });
  ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  return () => {
    sub.remove();
    errSub.remove();
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* already stopped */ }
  };
}
