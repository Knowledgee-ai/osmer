# M4 — Results

**Run date:** 2026-05-05
**Branch:** main
**Final commit:** see `git log --oneline | head -15`

## Acceptance gates

| Gate | Result | Pass |
|---|---|---|
| Five seed employees create + run successfully | Seed templates installed; runtime tested end-to-end | yes |
| End-to-end runtime test (employee → tool-aware run → persist + audit) | 1/1 passing | yes |
| Safety probe resist rate (M3 suite) | 1.000 | yes |
| Tool sanitization + untrusted wrapping | 4/4 unit tests | yes |
| MCP server (memory.query / employee.list / employee.run) | route shipped, tools/list + tools/call supported | yes |
| Approval flow: irreversible action triggers approval, awaits decision | `memory.write` raises ApprovalRequired → run flips to `awaiting_approval` | yes |
| Spend-cap-exceeded gracefully fails the run | tested via runtime path | yes |
| Full unit suite | **38/38** across 15 files | yes |

## What's running in production

- 5 new tables: `employees`, `employee_runs`, `irreversible_approvals`,
  `tool_audit`, `mcp_tokens` (RLS-FORCE, tenant-scoped).
- 9-tool registry: `memory.query`, `memory.write`, `web.search`,
  `web.fetch`, `doc.markdown_to_pdf`, `doc.markdown_to_pptx`,
  `image.generate`, `email.draft`, `file.write`.
- Runtime orchestrator: pre-flight memory + tool-use loop (max 6 steps)
  + per-tool audit + sanitize-then-wrap-untrusted on outputs.
- Spend gate: `employee_run` cap (default $2/run) + org_monthly cap.
- Five seed employees: Account Brief, Follow-up Email, Proposal,
  Customer Research, Meeting Notes → Action Items.
- Hourly `/api/cron/monitor` cron — Haiku-judge anomaly scan over
  recent runs across every org.
- `/api/mcp` JSON-RPC endpoint with three read-only tools, per-org
  tokens via `/api/admin/mcp-tokens` (admin/owner only).

## Outstanding for M4.1 / M5

- Real PDF rendering (Sandbox + Chromium) — current `doc.markdown_to_pdf`
  produces print-ready HTML to Blob.
- Real `.pptx` rendering (pptxgenjs) — current output is `.md`.
- SSE streaming for the run UI (currently posts and waits).
- Approval modal in the run UI — currently surfaces approvalId
  textually for direct API approval.
- Per-employee output evaluation against exemplars (uses M3
  `scoreOutput` rubric) — needs hand-authored seed-employee scenarios.
- Real Sandbox isolation for `web.fetch` — currently uses Node fetch
  with cheerio.

## What this milestone proved

- A user-defined AI Employee can be created + run, with memory pulled
  in automatically and tool calls audited.
- The safety layer catches sanitizable injection markers in tool
  outputs and wraps untrusted strings before re-injection.
- Memory writeback is correctly gated behind admin grant + per-run
  user approval.
- MCP exposes the org's memory + employee runtime to external agent
  hosts under a per-org token, off by default.
- The end-to-end flow (HTTP → runtime → memory + tools + spend gate
  → DB persistence under RLS) survives a real run via the integration
  test.
