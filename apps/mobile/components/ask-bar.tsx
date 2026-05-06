import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { startListening } from '../lib/voice';
import { apiJson } from '../lib/api';

interface AskResponse {
  answer: string;
  sources?: Array<{ n: number; content: string; score: number }>;
}

export function AskBar() {
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  async function ask(question: string) {
    if (!question.trim()) return;
    setThinking(true); setAnswer('');
    try {
      const j = await apiJson<AskResponse>('/api/knowledge/ask', {
        method: 'POST',
        body: JSON.stringify({ question, modelId: 'anthropic/claude-sonnet-4-6' }),
      });
      setAnswer(j.answer);
    } catch (err) {
      setAnswer(err instanceof Error ? err.message : 'Ask failed.');
    } finally {
      setThinking(false);
    }
  }

  async function toggle() {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
      setListening(false);
      void ask(transcript);
      return;
    }
    setTranscript(''); setAnswer('');
    setListening(true);
    stopRef.current = await startListening({
      onTranscript: (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          stopRef.current?.();
          stopRef.current = null;
          setListening(false);
          void ask(text);
        }
      },
      onError: (msg) => {
        setAnswer(msg);
        setListening(false);
        stopRef.current = null;
      },
    });
  }

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: '#fafaf7' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Pressable
          onPress={toggle}
          style={{
            width: 132,
            height: 132,
            borderRadius: 66,
            backgroundColor: listening ? '#c2683f' : '#2d2a26',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          {thinking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, letterSpacing: 1 }}>
              {listening ? 'STOP' : 'SPEAK'}
            </Text>
          )}
        </Pressable>
        <Text style={{ marginTop: 24, color: '#7b6043', fontSize: 12, letterSpacing: 1 }}>
          {listening ? 'LISTENING' : thinking ? 'SEARCHING MEMORY' : 'TAP TO ASK'}
        </Text>
      </View>

      {transcript ? (
        <View style={{ paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, color: '#2d2a26', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }}>
            &ldquo;{transcript}&rdquo;
          </Text>
        </View>
      ) : null}

      {answer ? (
        <View style={{ borderTopWidth: 1, borderTopColor: '#e8e3d8', paddingTop: 16 }}>
          <Text style={{ fontSize: 11, color: '#7b6043', letterSpacing: 1, marginBottom: 8 }}>ANSWER</Text>
          <Text style={{ fontSize: 15, color: '#2d2a26', lineHeight: 22 }}>{answer}</Text>
        </View>
      ) : null}
    </View>
  );
}
