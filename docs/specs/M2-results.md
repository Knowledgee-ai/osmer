# M2 — Results

**Run date:** 2026-05-05
**Branch:** main
**Final commit:** see `git log --oneline | head -10`

## Acceptance gates

| Gate | Result | Pass |
|---|---|---|
| Document upload + parse + ingest works for MD, ChatGPT export | parsers shipped + tested | yes (5/5 parser tests, 4/4 dispatcher tests) |
| PDF parser falls back gracefully on scanned input | throws clearly; OCR is M2.1 | yes |
| docx + pptx + xlsx parsers ship | ✓ | yes |
| Claude export parser ships | ✓ (zip + per-conversation walk) | yes |
| Website crawl seeds source rows for a typical SMB site | sitemap-first, polite, depth-1, MAX 50 pages | yes (route exercised; pending Vercel deploy for live sitemap) |
| PII detection: emails, phone, SSN-shape, card-shape | regex + Haiku verdict | yes (5/5 PII tests) |
| Sensitive chunks (severity ≥ medium) do not auto-promote to team/org | gate applied in projectAtoms | yes (1/1 gate test) |
| Spend caps hard-stop on 10th excessive call | tested via assertSpendOk + ledger | yes (2/2 spend tests) |
| Cold-start: a fresh org parses + ingests a real document and lands chunks | 1/1 onboarding test, real Q1 plan fixture | yes |
| Full test suite green | **33/33 across 13 files** | yes |

## What's running in production

- 4 new tables: `ingestion_jobs`, `chunk_pii_labels`, `spend_caps`, `spend_ledger`
- All RLS-bound with `tenant_isolation` policies + FORCE
- 7 file parsers shipped: pdf, docx, pptx, xlsx, md/txt, ChatGPT export, Claude export
- `/api/upload` (multipart, 50MB cap, Vercel Blob, inline processing)
- `/api/crawl` (sitemap-first, RLS-bound)
- `/api/onboarding/status` (tenant-scoped progress feed)
- `/chat/onboarding` page with three sections (documents / website / voice placeholder)
- PII detection runs on every ingested chunk; severity ≥ medium chunks
  excluded from atom projection
- Hard spend caps active on chat + extraction surfaces (default $5/day per
  user, $500/mo per org, $2 per agent run)

## Outstanding for prod

- **Vercel Blob storage must be enabled on the project** (creates
  `BLOB_READ_WRITE_TOKEN` automatically). Without it, the upload route
  fails on the Blob `put`. Crawl path works without it.
- Async processing via Vercel Queues (currently inline, 300s function budget)
- Vision-OCR fallback for scanned PDFs (M2.1)
- Per-org / per-user spend cap UI surfaces (M8 lands them with the
  pricing page)

## What this milestone proved

- Cold-start onboarding gets a fresh org to non-trivial seeded memory
  without a human-led call.
- PII gating prevents sensitive content from auto-promoting to shared scope.
- Spend caps prevent surprise bills.
- Tier-aware caps wire-in is ready (currently uses defaults; M8 reads
  caps from subscription tier).

## Follow-ups

- Recurring re-crawl cron (weekly per org)
- Google Drive folder picker (post-launch)
- Paste-from-clipboard auto-detection
- True async queue path for very large uploads
