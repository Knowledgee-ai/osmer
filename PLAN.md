# Osmer — Master Plan

> **Status.** This is the master plan. Every strategic and architectural call is anchored here. Implementation plans live separately under `docs/specs/` and break this down into shippable slices. Update this document when the strategy changes; update the specs when the work changes.

---

## 0. The wedge

### Who this is for

Sales orgs, consulting firms, marketing/creative agencies, and knowledge-intensive SMBs of 20-200 people. Specifically *not* engineering teams — they already have Cursor, Claude Code, Copilot, and a dev-tool buying motion that doesn't match this product. The buyer is a partner, principal, founder, or head-of-ops who can sign a $30-50/seat check without procurement, and the daily user opens the app between client calls.

### The problem

Every company of this size now runs on AI. Their people use ChatGPT, Claude, Gemini, and Grok every day to draft proposals, run customer research, build decks, write follow-ups, and analyze data. That work is generating real knowledge — decisions, customer specifics, win/loss reasons, frameworks that worked, language that landed — and **none of it accrues to the company**. It evaporates into private chat histories, scattered across providers, lost when an employee leaves or switches tools.

Today's workaround is to upload PDFs to ChatGPT/Claude. PDFs are static. The chats where the actual problem-solving happens are not. The knowledge keeps moving; the documents don't. Companies are blind to where their own intelligence is being made.

### What Osmer is

One app where:

1. **Every employee chats with every flagship model** — different models have different opinions and that's useful. Multi-model is table stakes, not a feature.
2. **Every conversation, every document, every voice-captured introduction feeds a single living company memory** — stored verbatim, indexed semantically, evolving daily through scheduled reconciliation.
3. **AI Employees act on that memory** — user-defined agents that the team builds by example ("here's what good looks like, do this for new inputs"), running on our cloud runtime to do real work: account research, deck drafts, follow-ups, financial pulls, content drafts.

Memory is the product. Multi-model chat is the daily entry point. AI Employees turn the memory into output. A mobile app keeps it close while the work is happening.

### What Osmer is not

A dev tool. A protocol body. A Notion replacement. A Glean. A Custom-GPT clone. A plugin to other people's runtimes. A federated standards play. Each of these has been on the table; each is explicitly out of scope.

---

## 1. Strategic principles

These are non-negotiable. Anything that violates one needs to be rejected, not adapted.

1. **Memory is verbatim. Atoms are projections.** Conversations, documents, and interview transcripts are stored as original text with rich metadata. "Atoms" — facts, decisions, preferences — are rendered views over that store, generated lazily for surfaces that need them. This kills entire categories of risk (extraction quality, dedup, conflict resolution) and makes evals tractable.
2. **The daily-evolution loop is real, not marketing.** Scheduled jobs (Vercel cron) re-rank, re-affirm, surface drift, and consolidate. Per-turn extraction runs on Vercel Queues. If the schedule isn't running, the product is broken.
3. **The agent runtime belongs to us.** Sales/consulting/marketing users can't bring their own runtime. We build on Vercel Sandbox + Workflow DevKit and own the execution layer. MCP is exposed for agent-tooling power users but is not the primary surface.
4. **Agents are user-defined, not hard-coded.** Users build "AI Employees" by giving examples and tools. We ship a runtime, not a roster of verticals. Custom GPTs proved this pattern; we add company memory and real tool execution.
5. **Multi-model is plumbing, not positioning.** Routed through Vercel AI Gateway. Users pick the model that fits the task. We do not market "10 models in one app" as the headline — that's commodity.
6. **Self-serve PLG, sales-followed.** Activation in the first 60 seconds matters more than enterprise polish. SOC 2, SSO, on-prem, and admin compliance surfaces come later, driven by paying customers asking for them.
7. **Mobile from the start.** Sales/consulting/marketing users live on phones between meetings. Expo/React Native shell ships in the same wave as the web rebuild, not as a year-end project.
8. **Evals before features.** Retrieval recall and AI Employee output quality are measured before any change ships. Without numbers, every architectural decision is faith-based.
9. **Memory is captured automatically — never asked for.** Every chat turn, every uploaded document, every interview transcript, every successful AI Employee run feeds the verbatim store without the user lifting a finger. The user's job is to talk, write, and work; the system's job is to remember. Users opt *out* (lock a conversation) rather than opt *in*. If someone has to click a "save to memory" button, we've failed the design.
10. **The memory has a face.** A live, interactive Memory Map renders the asset as it grows — topics, atoms, sources, entities, contributors. It's both a working navigation surface and the demo screenshot every customer takes back to their team. Section 3 covers the spec.

---

## 2. Technical architecture

### System overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  Web (Next.js 16)    Mobile (Expo / RN)    MCP Server (api)     │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              EDGE / API GATEWAY (Vercel)                         │
│  Auth · Rate limit · Tenant routing · Streaming                  │
└──┬──────────┬──────────┬──────────┬────────────┬───────────────┘
   │          │          │          │            │
┌──▼──┐  ┌────▼─────┐ ┌──▼─────┐ ┌──▼────────┐ ┌─▼──────────┐
│Chat │  │ Memory   │ │Agent   │ │Onboarding │ │Admin /     │
│Svc  │  │ Engine   │ │Runtime │ │Pipeline   │ │Analytics   │
└──┬──┘  └────┬─────┘ └──┬─────┘ └──┬────────┘ └─┬──────────┘
   │          │          │           │            │
┌──▼──────────▼──────────▼───────────▼────────────▼───────────────┐
│                       DATA LAYER                                  │
│  Neon Postgres + pgvector  ·  Vercel Blob  ·  Vercel Queues       │
└──┬───────────────────────────────────────────────────────────────┘
   │
┌──▼───────────────────────────────────────────────────────────────┐
│             EXECUTION + MODEL LAYER                               │
│  Vercel AI Gateway (all models)                                   │
│  Vercel Sandbox (agent steps, browser, code, doc gen)             │
│  Vercel Workflow DevKit (durable orchestration, retries, resume)  │
│  Vercel Cron (vercel.ts: daily/weekly evolution jobs)             │
└──────────────────────────────────────────────────────────────────┘
```

### Core services

**Chat service.** Streaming multi-model chat. Every turn is persisted verbatim with sender attribution, model used, tokens, cost, latency. Mid-conversation model switching preserved (a Sonnet thread can hand off to Opus or GPT-5.5 without losing context). Memory injection happens server-side before each model call.

**Memory engine.** Owns the verbatim store, embeddings, retrieval, projections, evolution loop. See Section 3 for the full spec — this is the heart of the product.

**Agent runtime.** Executes AI Employees. Sandbox for tool execution, Workflow DevKit for durability, a tool registry the AI Employee draws from. Memory is automatically injected and written back. See Section 5.

**Onboarding pipeline.** Three tiers (documents, website crawl, voice interview) feeding the same verbatim store with source-type metadata. See Section 4.

**Admin / analytics.** Cost dashboards, memory health, employee usage, audit trail. Light at first; deepens as paying customers ask.

### Database schema (core)

```sql
-- Tenancy
organizations (id, name, slug, plan, settings, created_at)
users (id, org_id, email, name, role, preferences, created_at)
teams (id, org_id, name, slug)            -- optional, surfaces only when org > ~10
team_members (team_id, user_id, role)

-- Verbatim source-of-truth store
sources (
  id, org_id, owner_user_id,
  type,                  -- conversation | document | interview | crawl
  title, status,
  meta jsonb,            -- per-type structured fields
  created_at, updated_at
)

source_chunks (
  id, source_id, org_id,
  ord int,               -- ordering within source
  role,                  -- user/assistant for conversations; null for docs
  speaker_user_id,       -- attribution within conversations / interviews
  content text,
  token_count int,
  embedding vector(1536),
  meta jsonb,            -- page, timestamp, section, etc.
  created_at
)

-- Conversation envelope (sources of type=conversation)
conversations (
  id == sources.id,
  visibility,            -- private | team | organization
  model_default,
  pinned_at, archived_at
)

-- Documents (sources of type=document) — Vercel Blob URLs
documents (
  id == sources.id,
  blob_url, mime_type, page_count, byte_size
)

-- Memory projections — generated, not authored
memory_atoms (
  id, org_id, scope_user_id, scope_team_id,
  type,                  -- fact | decision | preference (collapsed from 7)
  content,
  confidence, last_affirmed, affirmed_count,
  source_ids uuid[],     -- which chunks back this projection
  embedding vector(1536),
  status,                -- active | stale | superseded
  created_at, updated_at
)

-- AI Employees (user-defined agents)
employees (
  id, org_id, owner_user_id,
  name, description,
  inputs jsonb,          -- declared input schema
  toolbelt jsonb,        -- enabled tools
  example_source_ids uuid[],  -- few-shot anchors stored as sources
  shared boolean,
  version int,
  created_at, updated_at
)

employee_runs (
  id, employee_id, org_id, requested_by_user_id,
  inputs jsonb, status, started_at, completed_at,
  output_blob_url, output_text, cost,
  steps jsonb            -- ordered tool-call trace
)

-- Models, costs, audit
model_usage (id, org_id, user_id, model, tokens_in, tokens_out, cost, kind, ts)
audit_log (id, org_id, actor_user_id, action, target_type, target_id, meta, ts)
```

### Architecture decisions

- **Postgres + pgvector.** One database for relational + vector. We have it; it works at this scale; we don't add ops complexity until forced to.
- **Vercel AI Gateway.** All model calls route through it. No BYOK. Free observability, fallback chains, zero-data-retention claim, single billing line.
- **Vercel Queues for async.** Per-turn extraction, embedding generation, projection materialization. Public beta is fine — we're not at scale yet.
- **Vercel Sandbox + WDK.** Agent execution isolation + durability come from the platform, not from us reinventing them.
- **Single source-of-truth store for all input types.** Conversations, documents, interviews, and website crawls all become rows in `sources` + `source_chunks`. One index. One retrieval surface. One eval harness.

---

## 3. The memory layer

### What changes from the original plan

The original spec stored extracted atoms as the primary record with seven types, decay rates, version chains, conflict tables, and reconciliation that maintained all of it. That is the wrong primitive for 2026. With 1M-context Sonnet at $3/M tokens, the cost calculus has flipped — verbatim retrieval is now both cheaper and higher-fidelity than lossy compression. We collapse to:

- **Verbatim store** as the only authored record. Every chat turn, document chunk, and interview passage lives here with embeddings and metadata.
- **Atoms as projections** — a materialized view rendered for surfaces that need them (memory side-panel, AI Employee context summaries, dashboard health). Three types only: fact, decision, preference. Anything else collapses into one of those or stays implicit in the verbatim text.
- **Evolution as scheduled work**, not always-on background processing. Daily and weekly jobs do the heavy lifting; per-turn extraction is bounded.

### Retrieval

When a model call needs context, we retrieve from `source_chunks` directly:

1. Embed the active query (last user turn, AI Employee inputs, or explicit search).
2. Top-K cosine similarity over chunks within the user's accessible scope (own conversations + team-shared + org-shared).
3. Re-rank by recency × source-type weight × source confidence.
4. Inject as a system-prompt block with provenance (which conversation, which document, which page).

A collapsible "context used" panel shows the user every chunk that was injected. Trust comes from visibility.

### Projections

Atoms are generated by scheduled jobs and on-demand from surfaces. The projection job is:

1. Cluster recent chunks by topic (HDBSCAN over embeddings).
2. For each cluster, ask Sonnet to summarize stable patterns into atoms (fact / decision / preference).
3. Affirm existing atoms when the cluster reinforces them; supersede when content disagrees; create new when novel.
4. Write atoms with `source_ids` pointing back to the verbatim chunks that justify them.

Atoms are *display + projection* — they exist to give users a coherent map of what the system knows and to seed AI Employee briefings. The verbatim store is the truth.

### The evolution loop (`vercel.ts` + Queues)

| Job | Cadence | What it does |
|-----|---------|--------------|
| **Per-turn extraction** | Queued on chat completion, doc upload, interview save | Embed new chunks, index, queue projection refresh for affected topics |
| **Projection refresh** | Hourly per touched topic | Re-run clustering on changed regions; update affected atoms |
| **Affirmation sweep** | Daily | For atoms surfaced in successful retrievals, increment affirmed_count, refresh last_affirmed |
| **Drift sweep** | Daily | Apply soft decay to atoms with no recent affirmation; mark stale below threshold |
| **Disagreement scan** | Weekly | Find atoms that contradict more recent verbatim content; supersede with new version, link old via `supersedes` |
| **Consolidation** | Weekly | Cluster near-duplicate atoms; merge with attribution preserved |
| **Health snapshot** | Weekly | Per-org metrics: coverage by topic, freshness distribution, adoption rate |

No "cleanup" or "orphan archival" — verbatim chunks stay forever (subject to user deletion). Atoms can be regenerated if lost; chunks cannot.

### Privacy and scope

- **Personal** (default): only the user, only their own conversations and personal interview.
- **Team-shared**: scoped to a named team within the org.
- **Organization**: visible org-wide.
- **Locked conversation**: never extracted, never projected, never indexed beyond the user's own retrieval.

Scope checks run on every retrieval query at the database level. A locked conversation is invisible to projections and to other users' retrievals. Ever.

### The Memory Map

Memory is the company asset. We make that asset *visible*. The Memory Map is a live, interactive visualization of the memory layer — every topic, every atom, every source, every entity, every contributor — rendered as a graph the user can explore, filter, and navigate.

**Two views, one data model.**

- **2D working view (in-app).** Force-directed graph (react-force-graph). Filterable by node type, searchable, clickable. Selecting a node opens the underlying chunks and lets the user jump into the source conversation, document, or interview. This is the daily-use surface.
- **3D hero view (homepage, login, admin dashboard).** Same data, three.js renderer (react-three-fiber). Slow rotation, depth, light, animated growth. This is the marketing asset and the screenshot a partner takes back to the firm. Not the working surface — the *proof* surface.

**What's in the graph.**

| Node type | What it represents | Sized by |
|---|---|---|
| Topic | Cluster of related chunks (HDBSCAN over embeddings) | Total chunks in cluster |
| Atom | A projection (fact / decision / preference) | `affirmed_count` |
| Source | A document, conversation, interview, or crawled page | Number of chunks |
| Entity | A person, customer, product, or competitor mentioned across sources | Mention frequency |
| Contributor | An employee who authored sources or whose sources back atoms | Total contribution score |

Edges connect: atom → backed-by → source chunks; atom → about → entity; source → authored-by → contributor; topic → contains → atoms; atom → supersedes → prior atom (version chains).

**Contributor visibility, by design.**

Every node knows who contributed to it. The user can filter "show me Sarah's footprint" — Sarah-derived atoms and topics light up, the rest dim. A leaderboard pins to the side ("Top contributors this week"). Admins can toggle anonymous mode for cultures where attribution feels surveillance-coded.

This is not a vanity metric. Knowing whose work feeds the company memory makes the asset feel earned, not extracted — and gives the team a healthy social loop around contributing rather than hoarding knowledge in private chats.

**Computation and freshness.**

The graph is a projection, not a stored shape. A scheduled job (`memory.map.snapshot`, daily) recomputes topics, edges, and contributor weights from the verbatim store and writes a snapshot to a `memory_snapshots` cache table. The 2D view loads the snapshot, then layers a "what changed today" overlay (new topics, growing atoms, new entities). Live force-directed layout per chunk insert is too expensive — daily snapshots plus diff overlays give the live-feel at sane cost.

**Schema additions.**

The graph derives from existing tables (`source_chunks`, `memory_atoms`, `users`, `sources`) plus two new lightweight ones:

```sql
memory_entities (
  id, org_id, name, type,        -- person | customer | product | competitor | concept
  canonical_name, alias_count,
  embedding vector(1536),
  mention_count, last_seen,
  created_at
)

memory_snapshots (
  id, org_id, computed_at,
  nodes jsonb,                   -- precomputed nodes with sizes + positions
  edges jsonb,                   -- precomputed edges
  contributor_weights jsonb,
  topic_clusters jsonb
)
```

Entities are extracted by a projection job (NER prompt over recent chunks, dedupe via fuzzy match + embedding similarity into existing entities). The snapshot table is throwaway cache — we can rebuild any snapshot from the source chunks.

---

## 4. Onboarding — three tiers, one store

Cold-start is the make-or-break. A new org with empty memory has no reason to come back tomorrow. The onboarding flow is built so that within 10 minutes of signup, the company memory is non-trivially seeded and the user has felt the value.

### Tier 1 — Document upload (ship first)

Drag-and-drop, paste-from-clipboard, connect cloud drive. Supports:

- PDFs (with OCR for scans via a vision-capable model)
- Markdown, .docx, .pptx, .xlsx
- Notion, Confluence exports (zip)
- Google Drive folder selection (post-launch)
- Existing ChatGPT and Claude conversation exports — *this matters specifically because it captures the knowledge the team has already generated elsewhere*
- Slide decks and proposals (these become AI Employee few-shot examples in one click)

Each document becomes a `source` of type=document. Chunks go into `source_chunks` with page/section metadata. Embedding is queued. The user sees a progress feed ("Acme Q1 Proposal — 24 chunks indexed").

### Tier 2 — Website crawl (ship alongside Tier 1)

User pastes their company URL. A scheduled Sandbox job crawls the site (sitemap-first, depth-limited, polite). Captures positioning, products, pricing, customer logos, case studies, team bios. Each page is a `source` of type=crawl. Low information density per page, but zero user effort and it primes the voice interview.

### Tier 3 — AI voice interview (ship in the second wave)

Two flavors:

- **Founder/admin interview** (~20-30 minutes). After Tier 1 + 2 have seeded the system, an AI conducts a structured voice conversation: "Tell me about your customers. Walk me through a recent win. What's the pitch you give in the first meeting? What's a deliverable you're proud of?" The transcript becomes a high-density `source` of type=interview. Voice runs through OpenAI Realtime or ElevenLabs Conversational AI.
- **Per-employee intro** (~5 minutes). Each new team member gets a short voice intro: role, what they own, who they work with, recent projects. This captures tacit knowledge that nobody types out, and it scales the cold-start across the org without making every employee upload documents.

The voice tier is the demo magic. It's also the most fragile (realtime infra, conversational design, latency). It ships in the second wave so the foundation isn't held hostage to it.

---

## 5. AI Employees — the runtime

### The shape

Each AI Employee is four things, all user-defined:

- **Name and job description.** "Account Brief Drafter — given a prospect company, produces a 2-page meeting prep brief."
- **Examples (1-3).** Pasted text, uploaded deliverables, or references to existing `sources` in the org's memory. With 1M-context Opus we few-shot directly — no fine-tuning.
- **Inputs.** Free-text declaration that the runtime parses into a form: "a company name and the meeting context."
- **Toolbelt.** Checkboxed at creation:
  - Memory query (always on, scoped to org)
  - Memory writeback (off by default; admin grants)
  - Web search (Tavily / Exa)
  - Browser (Sandbox + Playwright; gated by complexity tier)
  - Document generation (markdown, PDF, .pptx)
  - Image generation
  - Email draft (output only, never sends without explicit user action)
  - File output to Blob

### The runtime

```
Run requested
   │
   ▼
1. Resolve inputs from the form
2. Retrieve memory: top-K chunks across employee's example_sources + org memory
3. Build system prompt: job description + examples + retrieved context + tool descriptions
4. Stream Sonnet/Opus with tool use enabled
5. Each tool call:
     - Memory query → pgvector
     - Web search → Tavily / Exa
     - Browser → Sandbox + Playwright
     - Doc gen → Sandbox (md → PDF / .pptx via templated render)
6. On completion: persist run, output, cost, step trace
7. If memory writeback enabled and user approves: extract atoms, route through normal projection pipeline
```

The runtime is one piece of code — the same shell runs every employee. Differentiation comes from the user's examples + tools + memory.

### Library + sharing

Every org gets a roster of saved employees, visible to the team. Owner can edit; team can clone-and-modify. Five seed employees ship with the product so a new org sees the pattern immediately:

1. Account / prospect brief
2. Follow-up email draft
3. Proposal draft (from a template the user uploaded during onboarding)
4. Customer research summary
5. Meeting notes → action items → memory writeback

Marketplace across orgs is a phase-3 idea — share when there's enough volume to make it worth curating.

### Why this beats hard-coded verticals

We don't have to predict whether the customer is a sales team or a consulting firm or a marketing agency. They build the employees that match their actual work. The runtime stays small. The product surface scales without us shipping new code per use case.

---

## 6. Multi-model chat

Everything you'd expect: streaming, mid-conversation model switch, conversation forking, history search, organize/pin, mobile-friendly markdown. All models route through Vercel AI Gateway.

What's different from a generic ChatGPT-clone:

- **Memory injected by default.** Every conversation starts already knowing what the company knows. The "context used" panel makes this visible.
- **Multi-participant conversations** for teams that want to think together with an AI in the room. Speaker attribution is preserved (`[Ana]: ...`). Already implemented in V1.
- **Saved as a source.** Every conversation feeds the company memory automatically (subject to privacy mode).
- **Hand to an AI Employee.** From any chat, the user can promote the conversation into an AI Employee run ("turn this into a proposal").

The model picker stays curated to ten frontier slots. We do not chase every release. When a frontier model launches, it replaces an existing slot if it earns one.

---

## 7. Mobile

### Why early

Sales, consulting, marketing buyers live on phones. The mobile app is not a "year-end project" — it ships in the same wave as the web rebuild. Without it, the wedge is incomplete.

### Approach

**React Native + Expo.** Code share with the web app where possible (state stores, API client, types). Real App Store presence (these buyers care). Credible v1 in days once the web API is stable.

### V1 mobile feature set

- Voice input → memory query → answer
- Conversation history (read + simple reply)
- Trigger an AI Employee run
- Push notifications when a run completes
- Brief review and share

Defer to V2 mobile: full chat composition, document upload, AI Employee builder UI, agent runtime UI.

The mobile app is consumption-mode for the V1 cohort. Composition stays desktop-first.

---

## 8. Privacy and trust

### The principle

**Verbatim is owned by the speaker; projections are owned by the org.** The company can see distilled knowledge atoms that summarize what's known. Raw conversations are visible only to participants and to scopes the participants chose.

Locked conversations are inert: not extracted, not projected, not indexed beyond the speaker's own retrieval. Admins cannot override this for individuals — they can only set defaults and require minimum scope on work conversations.

### Per-conversation modes

| Mode | Verbatim visibility | Projections visibility |
|------|---------------------|------------------------|
| Personal | Speaker only | Speaker only |
| Team-shared | Team members | Team members |
| Org-wide | Org members | Org members |
| Locked | Speaker only | None |

### User controls

- Default mode in settings; per-conversation override
- Review queue (optional): atoms wait for user approval before joining team/org scope
- Delete any source they own (cascades to chunks and to atoms backed by them)
- Forget conversation (hard delete)

### Admin controls

- Default mode for the org
- Minimum scope on work conversations (cannot override individual Lock)
- Audit log of access events
- Data export

### Data residency, SOC 2, HIPAA

Out of scope until paying customers ask. When they do, Vercel's enterprise primitives plus our verbatim/projection separation give us a clean story.

---

## 9. Business model

### Pricing

Self-serve PLG, with a clear free tier that gets a single user to value in under 10 minutes.

| Plan | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 1 user, all flagship models, 100 messages/month, 20 documents, 1 AI Employee, 25 employee runs/month |
| **Pro** | $30/user/month | Unlimited messages, unlimited documents, 5 AI Employees per user, 200 employee runs/month, voice onboarding, mobile app |
| **Team** | $50/user/month | Everything in Pro, plus shared employees, team memory scope, voice intros for new hires, basic admin |
| **Business** | $100/user/month | Everything in Team, plus org-wide memory, role-based access, audit logs, data export, priority support |

Pricing is a launch hypothesis. We adjust after the first 100 paying users tell us what they actually pay for.

### Compute economics

All model traffic routes through Vercel AI Gateway. Per-task agent runs are the variable-cost concern: a deep research run can be $1-5 in compute. Free tier caps prevent abuse. Pro/Team caps prevent surprise bills. Overage is billed at cost + 30% markup, with a hard ceiling the user opts in to before crossing.

### Unit economics target

At Team tier ($50/user):

```
Revenue:                      $50.00
AI / agent compute (avg):    -$12.00
Memory + embeddings:          -$2.00
Infrastructure:               -$2.00
                              ───────
Gross margin:                 $34.00 (68%)
```

These are targets, not promises. Real numbers come from the first cohort.

---

## 10. Go-to-market

### First 100 users

The wedge is so specific that we don't need a broad funnel. Direct outreach to sales/consulting/marketing operators in our network, hand-onboarded, with a "build me an AI Employee that does X" promise. Every onboarding produces a case study and a refined product.

### First 1,000 users

PLG channels matched to the audience:

- LinkedIn, not Hacker News. Founder-led content showing AI Employees doing real consulting/sales work.
- YouTube case studies: "How a 12-person consultancy ran 80 client research projects in a month."
- Indie Hackers and SaaS Twitter for the founder cohort.
- Targeted ads against terms like "sales research tools," "proposal automation," "consulting AI."
- Referral program: invite a teammate, get a month free.

### First $1M ARR

Outbound sales to the warm cohort that's grown above 5 seats organically. The Land-then-Expand pattern: a single sales rep brings the team in, then we sell the org.

### Phase 3 (year 2+)

- SOC 2 Type II
- Enterprise admin features (SSO, audit, data residency)
- Vertical templates and partnerships (sales enablement orgs, consulting franchises)

---

## 11. Competitive landscape

| | Osmer | ChatGPT Teams | Claude Teams | Glean | Notion AI | Manus | Custom GPTs |
|---|---|---|---|---|---|---|---|
| Multi-model | Yes | No | No | n/a | No | Yes | No |
| Verbatim org memory | Yes | No | No | Indexes existing | Limited | No | No |
| Daily evolution | Yes | No | No | Search-only | No | No | No |
| User-defined agents w/ tools | Yes | Limited | No | No | No | Yes | Limited |
| Memory feeds agents | Yes | No | No | No | No | No | No |
| Voice onboarding | Yes | No | No | No | No | No | No |
| Mobile-native | Yes | Yes | Yes | No | Yes | No | Via ChatGPT |
| SMB pricing | Yes | Yes | Yes | No | Yes | Yes | Yes |
| Audience fit (sales/consult/mktg) | Built for | Generic | Generic | Wrong segment | Adjacent | Closest | Generic |

### Positioning

- **Against ChatGPT/Claude Teams:** "They give your team better chat. Osmer turns your team's chats into a company asset that compounds — and lets you build the AI Employees that turn it into work."
- **Against Glean:** "Glean searches what you wrote yesterday. Osmer captures what your team is figuring out today."
- **Against Manus:** "Manus runs general agents. Osmer runs *your* agents — built on *your* knowledge, with *your* examples."
- **Against Custom GPTs:** "Custom GPTs forget your company. Osmer's AI Employees know it."

### Real risks

- **Manus or a similar agentic player ships memory.** Most likely competitor. Mitigation: be deeper on memory than they ever will be, and ship the consulting/sales-first GTM faster.
- **OpenAI / Anthropic ship company-memory.** They will. Multi-provider is the hedge — when memory is portable across models, single-provider lock-in is the worse choice.
- **The wedge segment uses 4-5 different point tools instead of consolidating.** Mitigation: AI Employee builder makes consolidation worth it. The runtime + memory is the integration point that nobody else owns.

---

## 12. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Memory retrieval quality is mediocre and the magic doesn't land | Critical | Eval harness from week 1. LongMemEval-style benchmark, internal task quality rubric. No retrieval change ships without moving the number. |
| AI Employee output quality is inconsistent and demos die | Critical | Few-shot anchors via 1M-context, tool registry tightly scoped, output review pre-send. Per-employee eval that grades outputs against the user's examples. |
| Cold-start onboarding feels empty for the first 24 hours | High | Three-tier onboarding (docs + crawl + voice) gives multiple paths to non-trivial seed memory in <10 min. |
| Voice realtime infra is unstable and the demo path is fragile | High | Voice ships in second wave. Tier 1+2 carry the activation moment until voice is solid. |
| Agent compute costs blow up unit economics | Medium | Per-tier run caps. Per-task budget ceilings the user opts in to. Tavily/Exa over browser by default. |
| Privacy breach: personal chat leaks to org | Critical | Verbatim is the source of truth and is scope-checked at the DB level. Locked conversations are inert. Audit log is honest. |
| Competitors close the gap with built-in memory | Medium | Be the cross-provider memory layer. Be more useful than any single provider's memory because we see all of it. |
| Mobile lags and sales/consulting buyers churn | Medium | Expo shell ships in V2 wave, not as a year-end project. |
| We over-build and ship slowly | High | Build sequence in Section 13 is opinionated about what each milestone proves. Anything not in the sequence is out. |

---

## 13. Build sequence

> Timeline-light by intent — we move at the velocity AI-augmented development allows. The sequence below is what proves the product, in order. Each milestone is a separate spec under `docs/specs/`.

### M1 — Memory rebuild on the verbatim store

Replace `knowledge_atoms` as the primary record. Migrate to `sources` + `source_chunks`. Re-index. Wire retrieval through chunks. Atoms become a generated projection. Daily/weekly cron via `vercel.ts`. Per-turn extraction onto Vercel Queues.

Proves: memory architecture works end-to-end, retrieval recall improves on a measurable benchmark.

### M2 — Onboarding tiers 1 + 2 (docs + crawl)

Drag-and-drop document upload (PDF/MD/docx/pptx/xlsx + ChatGPT/Claude exports). Website crawl via Sandbox cron. New-org flow that gets to a useful memory state in under 10 minutes.

Proves: cold-start works without a human-led onboarding call.

### M3 — Eval harness

LongMemEval subset for memory recall. Hand-curated AI Employee output rubric. CI runs on every memory or runtime PR.

Proves: we can ship with confidence. No more vibes-driven changes.

### M4 — AI Employees runtime + builder

Generic agent shell on Sandbox + WDK. Tool registry: memory r/w, web search, browser (gated), doc gen, image gen, email draft, file output. Builder UI for name + description + examples + inputs + toolbelt. Five seed employees.

Proves: the headline feature exists and works for at least three real use cases (account brief, proposal draft, follow-up writer).

### M5 — Memory Map (2D + 3D)

Entity extraction projection job. Daily `memory.map.snapshot` cron. 2D in-app force-directed graph with filters, search, click-through to source. Contributor sizing + leaderboard + filter-by-contributor. 3D hero renderer for the homepage and admin dashboard. Anonymous-mode admin toggle.

Proves: the asset is visible; the marketing screenshot is real; daily users have a way to navigate memory besides chat search.

### M6 — Mobile shell (Expo)

Voice input, memory query, conversation read, AI Employee trigger, push notifications. App Store + Play Store submission in parallel as a process track. Memory Map is web-only in V1 — mobile gets a flat list view of recent atoms instead.

Proves: mobile parity for consumption is real.

### M7 — Voice onboarding (Tier 3)

Founder/admin interview flow. Per-employee voice intros. OpenAI Realtime or ElevenLabs Conversational AI integration. Conversational design + structured extraction prompt. Voice transcripts feed the same verbatim store; the Memory Map shows the new contributors automatically.

Proves: the demo magic; the activation moment that closes self-serve users.

### M8 — Public launch

Three-tier onboarding live. AI Employees with five seeds. Mobile shell live. Pricing live. Eval harness gating every change. Memory evolution running on schedule.

Proves: we're a real product. First 100 paying users.

### M9+ — Sequencing driven by paying customers

Admin dashboard depth, audit log surfaces, SSO, more tools in the runtime, marketplace for AI Employees, integrations (Slack, Drive, Salesforce, HubSpot), SOC 2, multi-employee orchestration ("a team of AI Employees collaborating on a single deliverable").

What ships first in M9+ is whatever the cohort tells us is blocking expansion.

---

## 14. Out of scope (the explicit cut list)

These were in the original plan or have come up since. They are not coming back without a strong, evidence-based reason.

- **OMP as a published protocol.** Federation, RFC, ecosystem. Maybe a 2028 concern. Not now.
- **Manual graph editing.** The Memory Map is a projection — users navigate it, they don't author it. They edit underlying sources and atoms; the graph re-derives.
- **User-curated graph layouts.** Layout is automatic (force-directed). No save-my-arrangement. No node pinning beyond filter.
- **Public-share-a-graph.** Memory Maps are private to the org. Phase-3 idea at earliest.
- **Weekly knowledge digest as a feature.** Internal admin metric only.
- **Model arbitrage intelligence.** Premature optimization for a pricing problem we don't have.
- **"Ask the Company" as a separate mode.** It's just chat with the right context. Memory is always on.
- **Conflict resolution UI.** Atoms supersede automatically; no human queue.
- **Knowledge Replay as a marketed feature.** Atom version chains exist; we don't build a UI around them.
- **Browser extension.** Wrong distribution for this audience.
- **VS Code extension, MCP-first launch, Claude-Code-as-channel.** All wrong audience. MCP server ships, but as a power-user surface, not the headline.
- **Real-time CRDT collaboration.** Multi-participant conversations exist; full Google-Docs-style co-editing is overkill.
- **BYOK API keys.** Already removed. Stays removed.
- **Hard-coded vertical agents.** Replaced by user-defined AI Employees.
- **Enterprise-first features (SSO, SOC 2, on-prem) before paying customers ask.** Driven by demand, not by speculation.
- **Open protocol play, sdk, cli, federation.** Not in this cycle.

---

## 15. The killer insight

Companies of 20-200 people now run on AI. Their proposals, decks, briefs, follow-ups, and analyses are increasingly drafted in a chat window. The knowledge that *makes that work good* — the customer specifics, the patterns that win, the language that lands — is being generated every day and accruing to nobody. Not the company, not even the employee in any structured way. It evaporates the moment the chat tab closes.

PDFs in ChatGPT don't fix this. They're snapshots of last quarter's thinking, frozen the moment they were uploaded. The actual intelligence keeps moving.

Osmer is the place that intelligence lives. Multi-model chat is the entry point. Daily-evolving memory is the asset. AI Employees are how that asset becomes work. Mobile is how it stays close.

The moat is the memory itself. After three months, an Osmer org's memory contains thousands of decisions, customer details, frameworks, and worked examples that exist nowhere else. That's the switching cost. After six months, every AI Employee on the team is calibrated to the company's specific style, customers, and patterns. That's the network effect, internalized — every chat makes every agent better.

We're not building a smarter ChatGPT. We're building the company asset that compounds because the team is already doing the work that creates it.

---

## Appendix A — Tech stack reference

- **Framework:** Next.js 16 (App Router, TypeScript, RSC)
- **Styling:** Tailwind v4 + shadcn primitives (editorial, not stock)
- **Database:** Neon Postgres + pgvector
- **ORM:** Drizzle
- **Auth:** NextAuth v5 (credentials + email; SSO when demanded)
- **Models:** Vercel AI Gateway (single billing, observability, fallback)
- **Async:** Vercel Queues
- **Agent runtime:** Vercel Sandbox (Firecracker microVMs) + Workflow DevKit (durable orchestration)
- **Cron:** `vercel.ts` (replaces vercel.json)
- **Storage:** Vercel Blob (documents, employee outputs, voice recordings)
- **Mobile:** Expo / React Native
- **Memory Map:** react-force-graph (2D in-app), react-three-fiber + three.js (3D hero), HDBSCAN for topic clustering
- **State:** Zustand (web), TanStack Query for server state
- **Voice:** OpenAI Realtime (primary) / ElevenLabs Conversational AI (fallback)
- **Web search:** Tavily or Exa (decided per cost benchmark)
- **Doc generation:** Sandbox + templated render (markdown → PDF / .pptx)
- **Deploy:** Vercel (web + functions + cron + queues + sandbox all native)

## Appendix B — Spec breakdown

Implementation specs live under `docs/specs/`. Each milestone (M1-M7 above) gets its own spec covering: scope, file changes, data migration, eval criteria, ship gates.

- `docs/specs/M1-memory-verbatim-store.md`
- `docs/specs/M2-onboarding-docs-crawl.md`
- `docs/specs/M3-eval-harness.md`
- `docs/specs/M4-ai-employees-runtime.md`
- `docs/specs/M5-memory-map.md`
- `docs/specs/M6-mobile-expo-shell.md`
- `docs/specs/M7-voice-onboarding.md`
- `docs/specs/M8-public-launch-readiness.md`

These are written one at a time, in order, so each is informed by what shipped before it.
