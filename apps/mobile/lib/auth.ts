import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl
  ?? process.env.EXPO_PUBLIC_API_URL
  ?? 'https://www.osmer.ai';

const SESSION_KEY = 'osmer.session';

/**
 * NextAuth credentials sign-in over the deployed web API.
 * Captures the session cookie returned by the callback endpoint
 * into expo-secure-store; subsequent requests forward it on every
 * fetch.
 */
export async function signIn(email: string, password: string): Promise<boolean> {
  // CSRF
  const csrfRes = await fetch(`${API_URL}/api/auth/csrf`);
  if (!csrfRes.ok) return false;
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };

  const r = await fetch(`${API_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email, password, json: 'true' }).toString(),
    redirect: 'manual',
  });

  // The session cookie is set on either 200 or 30x; we capture from
  // the Set-Cookie header regardless of redirect status.
  const setCookie = r.headers.get('set-cookie') ?? '';
  if (!setCookie.includes('session-token')) return false;

  const sessionPart = setCookie
    .split(',')
    .find((c) => c.includes('session-token'));
  if (!sessionPart) return false;
  const cookie = sessionPart.split(';')[0]?.trim();
  if (!cookie) return false;

  await SecureStore.setItemAsync(SESSION_KEY, cookie);
  return true;
}

export async function getSessionCookie(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function getApiUrl(): string {
  return API_URL;
}
