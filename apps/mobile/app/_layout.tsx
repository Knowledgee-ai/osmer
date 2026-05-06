import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { queryClient } from '../lib/api';
import { getSessionCookie } from '../lib/auth';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}

/**
 * Redirect unauthenticated routes to /sign-in. Runs the session-cookie
 * check once on mount; routes update on segment change.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    getSessionCookie()
      .then((c) => setAuthed(!!c))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed == null) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!authed && !inAuthGroup) router.replace('/(auth)/sign-in');
    if (authed && inAuthGroup) router.replace('/(tabs)/ask');
  }, [authed, segments, router]);

  if (authed == null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}
