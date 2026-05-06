import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator, Platform } from 'react-native';
import { apiJson } from '../../lib/api';

interface Employee { id: string; name: string; description: string; }
interface RunResult { runId: string; status: 'complete' | 'awaiting_approval' | 'failed'; output: string; approvalId?: string; }

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [inputs, setInputs] = useState('{\n  \n}');
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiJson<{ employee: Employee }>(`/api/employees/${id}`)
      .then((j) => setEmp(j.employee))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [id]);

  async function run() {
    if (!id) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const parsed = JSON.parse(inputs);
      const r = await apiJson<RunResult>(`/api/employees/${id}/run`, {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fafaf7' }} contentContainerStyle={{ padding: 24 }}>
      {!emp ? (
        <ActivityIndicator />
      ) : (
        <>
          <Text style={{ fontSize: 22, color: '#2d2a26', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }}>
            {emp.name}
          </Text>
          <Text style={{ fontSize: 13, color: '#7b6043', marginTop: 6, lineHeight: 19 }}>{emp.description}</Text>

          <Text style={{ fontSize: 11, letterSpacing: 1, color: '#7b6043', marginTop: 28, marginBottom: 6 }}>INPUTS (JSON)</Text>
          <TextInput
            value={inputs}
            onChangeText={setInputs}
            multiline
            style={{ minHeight: 120, borderWidth: 1, borderColor: '#d6cfc1', borderRadius: 6, padding: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 13, color: '#2d2a26', backgroundColor: '#fff' }}
            placeholder='{ "customer": "Acme" }'
            placeholderTextColor="#a89c8a"
          />

          <Pressable
            onPress={run}
            disabled={busy}
            style={{ backgroundColor: '#2d2a26', padding: 14, borderRadius: 6, marginTop: 16, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Run</Text>}
          </Pressable>

          {err ? <Text style={{ color: '#c2683f', marginTop: 12, fontSize: 13 }}>{err}</Text> : null}

          {result ? (
            <View style={{ marginTop: 24, padding: 16, backgroundColor: '#f3eee2', borderRadius: 6 }}>
              <Text style={{ fontSize: 11, letterSpacing: 1, color: '#7b6043', marginBottom: 6 }}>
                {result.status.toUpperCase()} · run {result.runId.slice(0, 8)}…
              </Text>
              <Text style={{ fontSize: 14, color: '#2d2a26', lineHeight: 21 }}>{result.output}</Text>
              {result.status === 'awaiting_approval' ? (
                <Text style={{ marginTop: 12, fontSize: 12, color: '#c2683f' }}>
                  Awaiting approval (id {result.approvalId?.slice(0, 8)}…). Approve from the web app.
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
