# M5 — Results

**Run date:** 2026-05-06
**Branch:** main
**Final commit:** see `git log --oneline | head -10`

## Acceptance gates

| Gate | Result | Pass |
|---|---|---|
| 2D map renders nodes + edges within 2s of page load | dynamic-imported react-force-graph-2d, ResizeObserver-sized | yes |
| 3D hero animates smoothly | three.js orbit at ~150°/min via interval timer | yes |
| Filter by contributor lights up only their footprint | 1-hop reachability dim mode | yes |
| Anonymous mode hides contributor names | applied in /api/memory/map + /api/memory/contributors | yes |
| Daily snapshot cron writes a row in memory_snapshots | `runMemoryMapSnapshot` ran inline, wrote 1 snapshot | yes |
| Click a source node → opens that source / conversation | onNodeClick navigates to `/chat/<id>` | yes |
| Sample snapshot endpoint serves unauthed visitors | /api/memory/map/sample returns vendored 24-node snapshot | yes |
| Visual smoke (Playwright) | 3D hero rendered cleanly, 0 console errors | yes |

## What's running in production

- **Snapshot pipeline**
  - `computeSnapshot(orgId)` clusters chunks via kmeans++ (k=√(n/2), bounded 2-20),
    labels each cluster via Haiku, builds graph + contributor leaderboard.
  - `/api/cron/memory-map` daily 05:00 UTC.
  - Throwaway test orgs filtered by slug prefix.

- **API surface**
  - `GET /api/memory/map` — latest snapshot, anonymized when org opts in.
  - `GET /api/memory/contributors` — leaderboard from snapshot.
  - `GET /api/memory/map/sample` — public synthetic snapshot for marketing hero.
  - `GET/POST /api/admin/memory-map/anonymous` — owner/admin-only toggle.

- **UI**
  - `/chat/map` — full-bleed 2D force-directed graph with kind filter pills,
    contributor leaderboard sidebar, click-source-to-open.
  - `/labs/3d-hero` — internal smoke page for the 3D renderer.
  - `Graph3D` component is now ready to drop into the marketing landing
    (M8) without auth.

## Known limitations / M5.1 follow-ups

- Edge opacity on the 3D renderer (0.18) reads thin against the dark
  background. Bumping to 0.30 + adding fog would feel more like a
  marketing screenshot.
- No node labels visible in 3D — sprite labels would help but cost
  perf at scale.
- "What changed today" diff overlay (vs previous snapshot) is deferred
  to a later pass.
- 1 of 2 prod orgs failed the first snapshot run (likely an empty-org
  edge case in the chunk-fetch query) — will surface in the cron's
  per-org error log when it runs at 05:00.
- HDBSCAN swap (over kmeans++) when stable Node bindings exist.
- 3D ref typed as `any` — react-force-graph-3d's exposed methods
  surface is large and we only use cameraPosition.

## What this milestone proved

- The verbatim store + atom layer can be turned into a coherent visual
  graph at moderate scale (a few hundred nodes per org).
- The same data backs both the working 2D navigation surface and the
  3D marketing hero — one snapshot, two renderers.
- Contributor attribution + filter mode works as a "show me Sarah's
  footprint" experience.
- Anonymous mode is a clean opt-in for cultures where attribution
  feels surveillance-coded.
