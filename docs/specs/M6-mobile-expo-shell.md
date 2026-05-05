# M6 — Mobile Shell (Expo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A consumption-mode mobile app for sales/consulting/marketing users to query memory by voice, read recent conversations, trigger AI Employee runs, and get push notifications when those runs complete. Composition stays desktop-first; mobile is the in-meeting / in-transit surface.

**Architecture:** Expo SDK 53+ React Native app in a sibling repo path (`apps/mobile`) within the same monorepo. Shares types + API client with the web app via a `@osmer/api` workspace package. Auth via NextAuth credentials over the same `/api/auth` endpoints; sessions persisted with `expo-secure-store`. Voice input via `expo-speech-recognition`. Push via `expo-notifications` + Expo Push Service.

**Tech Stack:** Expo SDK 53+, expo-router (file-based routing), Tanstack Query, expo-secure-store, expo-speech-recognition, expo-notifications, EAS Build for App Store + Play Store.

---

## File Structure

**New files (under `apps/mobile/`):**

| Path | Responsibility |
|---|---|
| `apps/mobile/package.json` | Expo project manifest |
| `apps/mobile/app.json` | Expo config: name, bundle id, splash, icons, push permissions |
| `apps/mobile/eas.json` | EAS Build profiles |
| `apps/mobile/tsconfig.json` | TS config |
| `apps/mobile/babel.config.js` | Babel + reanimated plugin |
| `apps/mobile/app/_layout.tsx` | Root layout: providers, auth gate |
| `apps/mobile/app/(auth)/sign-in.tsx` | Sign-in screen |
| `apps/mobile/app/(tabs)/_layout.tsx` | Tab bar |
| `apps/mobile/app/(tabs)/ask.tsx` | Voice ask + memory answer |
| `apps/mobile/app/(tabs)/conversations.tsx` | Recent conversations list |
| `apps/mobile/app/(tabs)/employees.tsx` | AI Employees + recent runs |
| `apps/mobile/app/conversation/[id].tsx` | Conversation read |
| `apps/mobile/app/run/[id].tsx` | Run output viewer |
| `apps/mobile/lib/api.ts` | Tanstack Query client + auth headers |
| `apps/mobile/lib/auth.ts` | Sign-in / out + secure-store session |
| `apps/mobile/lib/voice.ts` | Voice recognition helpers |
| `apps/mobile/lib/notifications.ts` | Push registration + Expo token submit |
| `apps/mobile/components/ask-bar.tsx` | Big mic button + transcribed text + answer |
| `apps/mobile/components/employee-card.tsx` | Card for an AI Employee |

**New files in main app:**

| Path | Responsibility |
|---|---|
| `src/app/api/devices/register/route.ts` | Accept Expo push token from a signed-in mobile session |
| `src/lib/notifications/expo.ts` | `sendPush(userId, payload)` via Expo Push API |
| `drizzle/0012_devices.sql` | `devices` table (user_id, expo_push_token, platform) |

**Modified files:**

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | `devices` table |
| `src/lib/agent/runtime.ts` | On run complete, fire push to requesting user |

---

## Task 1: Expo project scaffold

**Files:**
- Create: `apps/mobile/` (full Expo skeleton)

- [ ] **Step 1: Init**

```bash
cd /Users/gui/Desktop/knowledgee
npx create-expo-app@latest apps/mobile --template tabs
cd apps/mobile
npx expo install expo-router expo-secure-store @tanstack/react-query expo-speech-recognition expo-notifications
```

- [ ] **Step 2: Configure `app.json`**

```json
{
  "expo": {
    "name": "Osmer",
    "slug": "osmer",
    "scheme": "osmer",
    "version": "0.1.0",
    "ios": { "bundleIdentifier": "ai.osmer.app", "supportsTablet": true, "infoPlist": { "NSMicrophoneUsageDescription": "Voice queries to your company memory.", "NSSpeechRecognitionUsageDescription": "Transcribe your voice for memory queries." } },
    "android": { "package": "ai.osmer.app", "permissions": ["RECORD_AUDIO"] },
    "plugins": [
      "expo-router",
      "expo-notifications",
      "expo-speech-recognition"
    ],
    "extra": { "router": { "origin": false } }
  }
}
```

- [ ] **Step 3: `eas.json`**

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "chore(mobile): scaffold Expo SDK 53 app with tabs template"
```

---

## Task 2: Auth — credentials sign-in over the web API

**Files:**
- Create: `apps/mobile/lib/auth.ts`
- Create: `apps/mobile/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/lib/api.ts`

- [ ] **Step 1: Auth helper**

```ts
import * as SecureStore from 'expo-secure-store';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.osmer.ai';

const SESSION_KEY = 'osmer.session';

export async function signIn(email: string, password: string): Promise<boolean> {
  // NextAuth credentials flow over the public callback endpoint.
  const csrf = await fetch(`${API}/api/auth/csrf`).then((r) => r.json()).then((j) => j.csrfToken as string);
  const r = await fetch(`${API}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken: csrf, email, password, json: 'true' }).toString(),
  });
  if (!r.ok) return false;
  const cookie = r.headers.get('set-cookie') ?? '';
  const session = cookie.split(',').find((c) => c.includes('session-token')) ?? '';
  if (!session) return false;
  await SecureStore.setItemAsync(SESSION_KEY, session.split(';')[0]);
  return true;
}

export async function getSessionCookie(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function signOut() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
```

- [ ] **Step 2: API client**

```ts
import { QueryClient } from '@tanstack/react-query';
import { getSessionCookie } from './auth';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.osmer.ai';

export const queryClient = new QueryClient();

export async function apiFetch(path: string, init: RequestInit = {}) {
  const cookie = await getSessionCookie();
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
  });
  return r;
}
```

- [ ] **Step 3: Sign-in screen**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { signIn } from '../../lib/auth';

export default function SignInScreen() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 32, justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontFamily: 'serif' }}>Osmer</Text>
      <TextInput placeholder="email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ borderBottomWidth: 1, marginTop: 24, paddingVertical: 8 }} />
      <TextInput placeholder="password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderBottomWidth: 1, marginTop: 16, paddingVertical: 8 }} />
      {err && <Text style={{ color: '#c2683f', marginTop: 8 }}>{err}</Text>}
      <Pressable
        onPress={async () => {
          const ok = await signIn(email, password);
          if (ok) router.replace('/(tabs)/ask'); else setErr('Sign in failed.');
        }}
        style={{ backgroundColor: '#2d2a26', padding: 14, borderRadius: 8, marginTop: 24 }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Sign in</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): credentials auth via web API + secure-store session"
```

---

## Task 3: Voice ask tab

**Files:**
- Create: `apps/mobile/app/(tabs)/ask.tsx`
- Create: `apps/mobile/components/ask-bar.tsx`
- Create: `apps/mobile/lib/voice.ts`

- [ ] **Step 1: Voice helper**

```ts
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export async function startListening(onTranscript: (text: string, isFinal: boolean) => void): Promise<() => void> {
  const sub1 = ExpoSpeechRecognitionModule.addListener('result', (e) => onTranscript(e.results[0]?.transcript ?? '', e.isFinal));
  ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  return () => { sub1.remove(); ExpoSpeechRecognitionModule.stop(); };
}
```

- [ ] **Step 2: AskBar**

```tsx
import { useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { startListening } from '../lib/voice';
import { apiFetch } from '../lib/api';

export function AskBar() {
  const [text, setText] = useState(''); const [answer, setAnswer] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  async function toggle() {
    if (stopRef.current) {
      stopRef.current(); stopRef.current = null;
      const r = await apiFetch('/api/knowledge/ask', { method: 'POST', body: JSON.stringify({ question: text, modelId: 'anthropic/claude-sonnet-4-6' }) });
      if (r.ok) { const j = await r.json(); setAnswer(j.answer); }
    } else {
      setText(''); setAnswer('');
      stopRef.current = await startListening((t, final) => { setText(t); if (final) setTimeout(toggle, 200); });
    }
  }
  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Pressable onPress={toggle} style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#c2683f', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginTop: 64 }}>
        <Text style={{ color: 'white', fontSize: 14 }}>{stopRef.current ? 'Stop' : 'Speak'}</Text>
      </Pressable>
      {text ? <Text style={{ marginTop: 24, fontSize: 16 }}>{text}</Text> : null}
      {answer ? <Text style={{ marginTop: 24, fontSize: 14, color: '#444' }}>{answer}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 3: Tab page**

```tsx
import { AskBar } from '../../components/ask-bar';
export default function AskTab() { return <AskBar />; }
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): voice ask — tap-to-talk → memory answer"
```

---

## Task 4: Conversations tab + read

**Files:**
- Create: `apps/mobile/app/(tabs)/conversations.tsx`
- Create: `apps/mobile/app/conversation/[id].tsx`

- [ ] **Step 1: List**

```tsx
import { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../lib/api';

export default function ConversationsTab() {
  const [list, setList] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
  const router = useRouter();
  useEffect(() => { apiFetch('/api/conversations').then((r) => r.json()).then((j) => setList(j.conversations ?? [])); }, []);
  return (
    <FlatList
      data={list}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/conversation/${item.id}`)} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
          <Text style={{ fontSize: 16 }}>{item.title}</Text>
          <Text style={{ fontSize: 12, color: '#777', marginTop: 4 }}>{new Date(item.updatedAt).toLocaleString()}</Text>
        </Pressable>
      )}
    />
  );
}
```

- [ ] **Step 2: Read**

```tsx
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { apiFetch } from '../../lib/api';

export default function ConversationRead() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [msgs, setMsgs] = useState<Array<{ id: string; role: string; content: string }>>([]);
  useEffect(() => { if (id) apiFetch(`/api/conversations/${id}/messages`).then((r) => r.json()).then((j) => setMsgs(j.messages ?? [])); }, [id]);
  return (
    <ScrollView style={{ padding: 16 }}>
      {msgs.map((m) => (
        <View key={m.id} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{m.role}</Text>
          <Text style={{ fontSize: 15 }}>{m.content}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): conversations list + read"
```

---

## Task 5: Employees tab + run trigger

**Files:**
- Create: `apps/mobile/app/(tabs)/employees.tsx`
- Create: `apps/mobile/app/run/[id].tsx`
- Create: `apps/mobile/components/employee-card.tsx`

- [ ] **Step 1: EmployeeCard**

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export function EmployeeCard({ id, name, description }: { id: string; name: string; description: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/run/${id}`)} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
      <Text style={{ fontSize: 16 }}>{name}</Text>
      <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }} numberOfLines={2}>{description}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: List**

```tsx
import { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import { apiFetch } from '../../lib/api';
import { EmployeeCard } from '../../components/employee-card';

export default function EmployeesTab() {
  const [list, setList] = useState<Array<{ id: string; name: string; description: string }>>([]);
  useEffect(() => { apiFetch('/api/employees').then((r) => r.json()).then((j) => setList(j.employees ?? [])); }, []);
  return <FlatList data={list} keyExtractor={(e) => e.id} renderItem={({ item }) => <EmployeeCard {...item} />} />;
}
```

- [ ] **Step 3: Run page**

```tsx
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable } from 'react-native';
import { apiFetch } from '../../lib/api';

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inputs, setInputs] = useState('{}'); const [output, setOutput] = useState(''); const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setOutput('');
    const r = await apiFetch(`/api/employees/${id}/run`, { method: 'POST', body: inputs });
    if (r.ok) { const j = await r.json(); setOutput(j.output ?? ''); }
    setBusy(false);
  }
  return (
    <ScrollView style={{ padding: 16 }}>
      <TextInput value={inputs} onChangeText={setInputs} multiline style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, fontFamily: 'Courier' }} />
      <Pressable onPress={run} style={{ backgroundColor: '#2d2a26', padding: 12, borderRadius: 6, marginTop: 12 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>{busy ? 'Running…' : 'Run'}</Text>
      </Pressable>
      {output ? <Text style={{ marginTop: 16, fontSize: 14 }}>{output}</Text> : null}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): employees list + run trigger"
```

---

## Task 6: Push notifications

**Files:**
- Create: `apps/mobile/lib/notifications.ts`
- Create: `src/app/api/devices/register/route.ts`
- Create: `src/lib/notifications/expo.ts`
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/agent/runtime.ts`

- [ ] **Step 1: Devices table**

```ts
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  expoPushToken: text('expo_push_token').notNull(),
  platform: varchar('platform', { length: 16 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('devices_token_idx').on(t.expoPushToken),
  index('devices_user_idx').on(t.userId),
]);
```

```bash
npx drizzle-kit generate --name devices && npx drizzle-kit push
```

Apply RLS in `drizzle/0013_rls_devices.sql`.

- [ ] **Step 2: Register endpoint**

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { expoPushToken, platform } = await req.json() as { expoPushToken: string; platform: 'ios' | 'android' };
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  await db.insert(devices).values({ userId: session.user.id, orgId: me!.orgId!, expoPushToken, platform }).onConflictDoNothing();
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Send push helper**

```ts
import { db } from '@/lib/db';
import { devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function sendPush(userId: string, payload: { title: string; body: string; data?: Record<string, unknown> }) {
  const list = await db.select().from(devices).where(eq(devices.userId, userId));
  if (list.length === 0) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(list.map((d) => ({ to: d.expoPushToken, title: payload.title, body: payload.body, data: payload.data }))),
  });
}
```

- [ ] **Step 4: Wire into runtime**

In `src/lib/agent/runtime.ts`, after the `db.update(employeeRuns).set({ status: 'complete' ... })`:

```ts
import { sendPush } from '@/lib/notifications/expo';
// ...
await sendPush(args.userId, { title: 'Run complete', body: `${emp.name} finished.`, data: { runId: run.id, employeeId: emp.id } });
```

- [ ] **Step 5: Mobile registration**

```ts
import * as Notifications from 'expo-notifications';
import { apiFetch } from './api';

export async function registerForPush() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const tokenResp = await Notifications.getExpoPushTokenAsync();
  await apiFetch('/api/devices/register', { method: 'POST', body: JSON.stringify({ expoPushToken: tokenResp.data, platform: 'ios' }) });
}
```

Call `registerForPush()` from `app/_layout.tsx` once after auth.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ src/app/api/devices/ src/lib/notifications/ src/lib/agent/runtime.ts src/lib/db/schema.ts drizzle/
git commit -m "feat(mobile): push notifications when AI Employee runs complete"
```

---

## Task 7: EAS build setup + acceptance

**Files:**
- Create: `docs/specs/M6-results.md`

- [ ] **Step 1: TestFlight build**

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli build --profile preview --platform ios
npx eas-cli build --profile preview --platform android
```

(Submission to App Store / Play Store is a process track — not a code task. Document the steps and credentials needed.)

- [ ] **Step 2: Results**

```markdown
# M6 — Results

| Gate | Result |
|---|---|
| Sign-in works against production API on iOS + Android | |
| Voice ask returns answers within 5s for typical queries | |
| Employees list + run + output viewer functional | |
| Push notification fires within 30s of run completion | |
| App Store TestFlight build accepted | |
| Play Store internal testing build accepted | |
```

- [ ] **Step 3: Commit**

```bash
git add docs/specs/M6-results.md
git commit -m "docs(m6): mobile acceptance template"
```

---

## Self-review

- Auth ✓ (T2)
- Voice ask ✓ (T3)
- Conversations read ✓ (T4)
- Employees + run ✓ (T5)
- Push on run complete ✓ (T6)
- TestFlight / Play Store path documented ✓ (T7)

**Deferred:** Document upload from mobile, AI Employee builder UI, Memory Map (web-only in V1), settings UI parity, dark mode polish, offline mode.
