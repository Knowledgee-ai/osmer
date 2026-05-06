import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { signIn } from '../../lib/auth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fafaf7' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, padding: 32, justifyContent: 'center' }}>
        <Text style={{ fontSize: 32, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), color: '#2d2a26' }}>Osmer</Text>
        <Text style={{ fontSize: 14, color: '#7b6043', marginTop: 6 }}>Your team&rsquo;s knowledge HQ.</Text>

        <View style={{ marginTop: 36 }}>
          <Text style={{ fontSize: 11, letterSpacing: 1, color: '#7b6043', marginBottom: 6 }}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={{ borderBottomWidth: 1, borderBottomColor: '#d6cfc1', paddingVertical: 8, fontSize: 16, color: '#2d2a26' }}
            placeholder="you@example.com"
            placeholderTextColor="#a89c8a"
          />
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 11, letterSpacing: 1, color: '#7b6043', marginBottom: 6 }}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            style={{ borderBottomWidth: 1, borderBottomColor: '#d6cfc1', paddingVertical: 8, fontSize: 16, color: '#2d2a26' }}
            placeholder="••••••••"
            placeholderTextColor="#a89c8a"
          />
        </View>

        {err ? <Text style={{ color: '#c2683f', marginTop: 16, fontSize: 13 }}>{err}</Text> : null}

        <Pressable
          onPress={async () => {
            if (busy) return;
            setBusy(true); setErr(null);
            try {
              const ok = await signIn(email.trim(), password);
              if (ok) router.replace('/(tabs)/ask');
              else setErr('Sign in failed. Check your email and password.');
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Sign in failed.');
            } finally {
              setBusy(false);
            }
          }}
          style={{ backgroundColor: '#2d2a26', padding: 16, borderRadius: 6, marginTop: 32, alignItems: 'center' }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15 }}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
