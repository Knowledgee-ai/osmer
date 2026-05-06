import { QueryClient } from '@tanstack/react-query';
import { getSessionCookie, getApiUrl } from './auth';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookie = await getSessionCookie();
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type') && init.body && typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }
  if (cookie) headers.set('cookie', cookie);
  return fetch(`${getApiUrl()}${path}`, { ...init, headers });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await apiFetch(path, init);
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`api ${path} → ${r.status}${txt ? `: ${txt.slice(0, 200)}` : ''}`);
  }
  return r.json() as Promise<T>;
}
