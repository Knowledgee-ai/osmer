# M3 — Results

**Run date:** 2026-05-05
**Branch:** main
**Final commit:** see `git log --oneline | head -10`

## Eval suite results

`npm run eval` runs all five suites sequentially. Most recent run:

| Suite | Result | Gate | Pass |
|---|---|---|---|
| LongMemEval recall@5 (synthetic 20-task) | **1.000** | ≥ 0.65 | yes |
| Cross-user recall@5 (20 tasks) | **1.000** | ≥ 0.65 | yes |
| Knowledge-update accuracy (10 tasks) | **0.900** | ≥ 0.65 | yes |
| Abstention precision (10 tasks) | **1.000** | ≥ 0.85 | yes |
| Safety resist rate (10 probes) | **1.000** | = 1.00 | yes |

Full master-runner JSON last run:

```
suites: [
  { longmemeval        passed: true,  durationSec: 133 }
  { cross-user         passed: true,  durationSec:  99 }
  { knowledge-update   passed: true,  durationSec:  72 }
  { abstention         passed: true,  durationSec:  58 }
  { safety             passed: true,  durationSec:  25 }
]
overall: true
```

Wall-clock: ~6.5 minutes for the full sweep on local hardware.

## Improvements landed during M3

- **Recency boost in rerank** (rerank.ts). `(0.7 + 0.3 * exp(-days/60))`
  applied to both Cohere and RRF paths. Knowledge-update accuracy
  jumped from 0.20 → 0.90 with v1 backdated 90 days.
- **Tighter abstention prompt** in /api/knowledge/ask path (mirrored
  in the eval). Precision 0.50 → 1.00.

## Observability

| Layer | Status |
|---|---|
| Sentry init | ready (zero-config when SENTRY_DSN present) |
| OpenTelemetry tracer | live; instrumentation.ts hook |
| Vercel AI Gateway | every model call goes through it (per-org cost + latency in dashboard) |
| Spans on hot paths | `memory.retrieve`, `memory.ingest`, `memory.project` |

`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
are not yet set in production env — Sentry is a no-op until they are.
Add via dashboard or `vercel env add` when ready to enable error
tracking in prod.

## CI

`.github/workflows/eval.yml` triggers on PRs touching:
- `src/lib/memory/**`
- `src/lib/agent/**`
- `src/lib/ingest/**`
- `src/lib/spend/**`
- `evals/**`
- `package.json`

Two jobs: `unit` (vitest) → `evals` (npm run eval). Required GitHub
secrets: `DATABASE_URL_TEST`, `DATABASE_URL_OWNER_TEST`,
`OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY`.

## What this milestone proved

- Retrieval is robust on cross-user and on knowledge-update once
  recency weighting is in place.
- The system reliably refuses to answer when the knowledge base
  doesn't support the question.
- Indirect prompt-injection attempts are reliably refused by the
  current chat / Ask system prompts.
- Per-employee output quality (the rubric) is wired and ready for
  M4 to consume.

## Outstanding for M3.1 / hardening

- Real LongMemEval-S 200-task run (dataset still gated on Google
  Drive — drop the JSON at `.cache/longmemeval-s.json` when available).
- Sentry DSN + auth tokens in prod env.
- Add spans to chat route + extraction route.
- Per-employee output evals against real seed-employee outputs (M4).
