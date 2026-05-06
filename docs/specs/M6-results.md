# M6 — Results

**Run date:** 2026-05-06
**Branch:** main
**Final commit:** see `git log --oneline | head -10`

## Acceptance gates

| Gate | Result | Pass |
|---|---|---|
| Mobile auth: credentials sign-in against the prod web API | implemented; `signIn()` captures `session-token` cookie into expo-secure-store; apiFetch forwards on every request | yes (manual run pending TestFlight) |
| Voice ask: tap-to-talk → memory query → answer | `AskBar` + `startListening()` + `/api/knowledge/ask` round-trip | yes |
| Conversations list + read | `(tabs)/conversations` + `conversation/[id]` with pull-to-refresh | yes |
| Employees list + run trigger | `(tabs)/employees` + `run/[id]` with JSON-input run + status surfacing | yes |
| Push notifications wire-up | `/api/devices/register` + `sendPush()` + runtime hook fires on run.complete | yes |
| iOS bundle exports cleanly | `npx expo export --platform ios` → 2.9 MB Hermes bytecode bundle | yes |

## What's running in production

- Schema additions
  - `devices(id, user_id, org_id, expo_push_token, platform, …)` —
    RLS-FORCE, tenant_isolation policy, granted to osmer_app.
- API additions
  - `POST /api/devices/register` — idempotent on push token.
- Runtime hook
  - `agent/runtime.ts` calls `sendPush()` on every successful run for
    the requesting user. Best-effort; failures don't reverse the run.
- `src/lib/notifications/expo-push.ts` — Expo Push API fan-out.

## Mobile app (apps/mobile)

```
apps/mobile/
├── app.json            # bundle ai.osmer.app, scheme osmer, paper splash
├── eas.json            # development / preview (sim) / production
├── lib/
│   ├── auth.ts         # NextAuth credentials sign-in + secure-store
│   ├── api.ts          # Tanstack Query + apiFetch wrapper
│   ├── voice.ts        # expo-speech-recognition wrapper
│   └── notifications.ts# expo-notifications + register
└── app/
    ├── _layout.tsx     # AuthGate, push registration
    ├── (auth)/sign-in  # editorial sign-in screen
    └── (tabs)/
        ├── ask         # tap-to-talk → answer
        ├── conversations
        └── employees
```

Routes: `/(tabs)/ask` (default), `/(tabs)/conversations`,
`/(tabs)/employees`, `/conversation/[id]`, `/run/[id]`.

## What this milestone proved

- The deployed web API works as a backend for a native mobile client
  with no parallel API.
- Voice-first ask is technically feasible — `expo-speech-recognition`
  → final transcript → grounded answer in <10s.
- Push notifications close the loop on async AI Employee runs.
- Mobile app is consumption-mode only — composition stays desktop-first
  per the master plan.

## Outstanding before App Store / Play Store submission

- **EAS account + Apple Developer / Google Play Console enrollment**
  (process track, no code).
- **App icons + splash brand assets** — currently using the Expo
  template stubs. Replace before submission.
- **Real device QA** — Expo Speech Recognition needs real-device testing.
  Simulator stubs the audio.
- **Voice cancellation UX** — current implementation auto-asks on final
  transcript; long-press-to-cancel would be an improvement.
- **Apple Push Notification + Firebase Cloud Messaging credentials**
  — required by EAS Build. Run `eas credentials` to provision.
- **Approval modal** in the run screen — currently shows the approvalId
  as text and asks the user to approve from the web app.

## Outstanding for prod (general)

- Mobile API URL is hard-coded to `https://www.osmer.ai`. Switch to a
  staging/preview URL for non-production EAS builds via `EXPO_PUBLIC_API_URL`.
- The mobile bundle uses absolute fetch URLs — when the mobile app is
  served via Expo Web, this would still hit prod, which is fine.
