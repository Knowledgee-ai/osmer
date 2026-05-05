# M1 — Results

**Run date:** 2026-05-05
**Branch:** main
**Final commit:** see `git log --oneline | head -25`

## Acceptance gates

| Gate | Result | Pass |
|---|---|---|
| Hybrid retrieval recall@5 ≥ 0.65 (synthetic LongMemEval, 20 tasks) | **1.000** | yes |
| Cross-tenant RLS test passing (read + write paths) | 2/2 tests | yes |
| Five evolution cron jobs registered + handler smoke-tested | 5/5 + `health` returns 20 snapshots | yes |
| Chat ingestion writes to `source_chunks` for every turn | wired in `onFinish` | yes |
| `knowledge/ask` returns answers grounded in retrieved chunks | wired | yes |
| `knowledge/search` + `/api/v1/knowledge` cut over to retrieve() | done | yes |
| Legacy data migration completes | 7/7 atoms migrated | yes |
| Full test suite green | **20/20 in 8 files** | yes |
| Production `DATABASE_URL` swapped to non-bypass `osmer_app` | done via `vercel env` | yes |

## Eval JSON (synthetic LongMemEval)

```json
{
  "total": 20,
  "recallAt5": 1,
  "byType": {
    "single-session-user": { "total": 10, "hits": 10 },
    "knowledge-update":    { "total": 3,  "hits": 3 },
    "multi-session":       { "total": 4,  "hits": 4 },
    "temporal-reasoning":  { "total": 3,  "hits": 3 }
  }
}
```

> Synthetic dataset, not the real LongMemEval-S — the real dataset
> is gated on Google Drive (manual download). The runner is generic;
> drop the real JSON at `.cache/longmemeval-s.json` and the loader
> uses it. M3 swaps in the real data + adds abstention + cross-user.

## What's running in production

- 6 new tables: `sources`, `source_chunks`, `memory_atoms`,
  `memory_entities`, `entity_links`, `memory_snapshots`
- HNSW indexes on every vector column; GIN on tsvector; trigram on entity name
- RLS forced on every tenanted table; `osmer_app` is non-BYPASSRLS
- Three retrieval signals (semantic + lexical + entity) reranked by Cohere with RRF fallback
- Chat route ingests verbatim turns + retrieves hybrid context per request
- Five cron handlers on `vercel.json` (affirmation / drift / disagreement / consolidation / health)
- Daily/weekly schedule live; `CRON_SECRET` set in production env

## Follow-ups (M3 / hardening)

- Real LongMemEval-S 200-task run (need the dataset locally)
- Cross-user / abstention / safety probe eval suites (M3)
- HDBSCAN-based clustering in `projection.ts` (currently single-pass with kmeans++ as the M5 entry point)
- Cohere vs Voyage rerank cost benchmark
- Drop legacy `knowledge_atoms` table after a 1-week soak
- Vercel Queues real integration (currently fire-and-forget Promise chain in chat onFinish)
- Sentry / OpenTelemetry instrumentation (M3)
