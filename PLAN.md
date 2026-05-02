# Knowledge HQ — Full Product Plan

## The Core Problem

Companies and individuals use AI extensively across multiple models (ChatGPT, Claude, Gemini, Grok). This creates **knowledge fragmentation**:

- Chats are isolated between LLMs — context doesn't transfer
- Companies have no access to the knowledge employees generate in AI conversations
- Employees often use personal subscriptions for work — the company is blind to this knowledge
- When employees leave, their AI-generated knowledge walks out the door
- This is the **"shadow AI" problem** — the AI equivalent of shadow IT

## The Vision

A single platform where:
- Companies sign up and add all employees
- Everyone accesses all flagship AI models (via OpenRouter or direct API integrations)
- A self-evolving memory system (inspired by Claude's memory/.md approach) learns from every conversation
- Knowledge flows through three tiers: Personal → Team → Company
- Team members collaborate on chats
- The company's knowledge base grows organically with every AI interaction
- A reconciliation engine (cron-based) keeps knowledge fresh, resolves conflicts, and identifies gaps

---

## 1. TECHNICAL ARCHITECTURE

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                         │
│  Web App (Next.js)  •  Desktop (Electron)  •  API       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    API GATEWAY                            │
│  Auth  •  Rate Limiting  •  Tenant Routing               │
└──────┬──────────┬──────────┬──────────┬─────────────────┘
       │          │          │          │
┌──────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼──────────────┐
│  Chat    │ │ Memory │ │ Collab │ │  Admin            │
│  Service │ │ Engine │ │ Service│ │  Dashboard        │
└──────┬───┘ └───┬────┘ └───┬────┘ └───┬──────────────┘
       │         │          │          │
┌──────▼─────────▼──────────▼──────────▼──────────────────┐
│                    DATA LAYER                             │
│  Postgres + pgvector  •  Redis  •  S3  •  Queue (Bull)   │
└──────┬──────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│                 MODEL ROUTER LAYER                        │
│  OpenRouter  •  Direct APIs (Anthropic, OpenAI, Google,  │
│  xAI, Meta)  •  Fallback chains  •  Cost tracking        │
└─────────────────────────────────────────────────────────┘
```

### Key Services

**Chat Service**
- Manages conversation lifecycle (create, stream, fork, share)
- Handles model routing — user selects model per message or per conversation
- Streams responses via WebSocket/SSE
- After each assistant response, emits a `chat.message.completed` event to the Memory Engine
- Supports conversation forking: take a conversation and continue with a different model
- Stores raw conversation history in Postgres with full message metadata (model used, tokens, latency, cost)

**Model Router Layer**
- Abstraction over multiple providers. Each provider is a plugin:
  ```
  interface ModelProvider {
    id: string                    // "openai", "anthropic", "google"
    models: Model[]               // available models
    chat(req: ChatRequest): AsyncStream<ChatChunk>
    estimateCost(req: ChatRequest): CostEstimate
  }
  ```
- OpenRouter as a fallback/convenience layer, but direct integrations for:
  - Lower latency (one fewer hop)
  - Better error handling and retry logic
  - Access to provider-specific features (Claude's artifacts, GPT's code interpreter, Gemini's grounding)
  - Cost optimization (negotiate volume discounts directly)
- Smart routing options:
  - "Best for code" → routes to Claude or GPT based on benchmark/preference
  - "Cheapest that's good enough" → cost-optimized routing
  - "Fastest response" → latency-optimized
  - Company admin can set model policies ("no model X for compliance reasons")

**Memory Engine** (the core differentiator — detailed in Section 2)

**Collaboration Service**
- Real-time shared conversations (CRDT-based or OT for concurrent edits)
- @mentions to pull teammates into conversations
- Chat handoffs with context preservation
- Comment threads on specific messages within a conversation
- "Publish to team" — take a private chat and make key parts visible to the team

**Admin/Analytics Service**
- Usage dashboards (cost per user, per team, per model)
- Knowledge base health metrics
- Compliance audit logs
- User management, role assignment, SSO integration

### Database Schema (Core)

```sql
-- Multi-tenant foundation
organizations (id, name, slug, plan, settings, created_at)
teams (id, org_id, name, slug, settings)
users (id, org_id, email, name, role, preferences)
team_members (team_id, user_id, role)

-- Chat layer
conversations (id, org_id, user_id, team_id, title,
               visibility, model_default, created_at)
messages (id, conversation_id, role, content, model_used,
          tokens_in, tokens_out, cost, created_at)
conversation_participants (conversation_id, user_id, role, joined_at)

-- Knowledge layer (the core IP)
knowledge_atoms (
  id, org_id,
  type,           -- fact, decision, preference, solution,
                  -- relationship, process, context
  scope,          -- personal, team, organization
  content,        -- human-readable statement
  structured,     -- JSON: entities, relationships, metadata
  confidence,     -- 0.0-1.0
  decay_rate,     -- how fast it goes stale
  version,        -- increments on updates
  supersedes_id,  -- previous version
  source_conversation_id,
  source_user_id,
  extracted_by,   -- which model extracted it
  embedding,      -- vector(1536) for semantic search
  last_affirmed,  -- last time this was confirmed true
  created_at
)
knowledge_access (atom_id, scope, team_id, anonymized)
knowledge_conflicts (atom_a_id, atom_b_id, status, resolved_by, resolved_at)
knowledge_entities (id, org_id, name, type, metadata)
knowledge_entity_links (atom_id, entity_id, relationship)

-- Analytics
model_usage (id, org_id, user_id, model, tokens, cost, date)
knowledge_retrievals (id, atom_id, conversation_id, was_useful)
```

### Key Architecture Decisions

**Why Postgres + pgvector instead of a dedicated vector DB:**
At the scale of V1-V2 (tens of thousands of knowledge atoms per org), pgvector handles semantic search fine. It eliminates operational complexity of a separate vector DB. You can migrate to Pinecone/Qdrant later if scale demands it, but most companies will never hit that threshold.

**Why OpenRouter first, direct APIs second:**
OpenRouter gives you 100+ models with one integration. Ship faster, validate the product, then add direct API integrations for the top 4-5 providers to reduce margin loss and latency. Keep OpenRouter as fallback.

**Why a queue for knowledge extraction:**
Knowledge extraction must be async. Never block the chat experience. A user sends a message, gets a streamed response. Meanwhile, a background job analyzes the conversation for knowledge. Bull/BullMQ on Redis is simple and battle-tested.

**Streaming architecture:**
Each provider has different streaming APIs (SSE for OpenAI, SSE for Anthropic, etc.). The model router normalizes these into a single SSE stream to the client. This abstraction is critical — the frontend doesn't care which model is responding.

### The Knowledge Extraction Pipeline (detailed)

```
Conversation Turn Completed
         │
         ▼
┌─────────────────────┐
│ 1. BUFFER & BATCH   │  Don't extract on every message.
│    Wait for natural  │  Wait for conversation pauses
│    pause (30s idle)  │  or explicit "end of topic" signals.
│    or topic shift    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 2. TOPIC CHUNKING   │  A conversation about 3 topics
│    Segment into      │  produces 3 extraction jobs,
│    coherent topics   │  not one giant blob.
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 3. ENTITY EXTRACT   │  Identify: people, systems,
│    Named entities,   │  technologies, projects, processes.
│    fuzzy-match to    │  Link to existing entities in
│    existing graph    │  the org's knowledge graph.
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 4. ATOM EXTRACTION   │  For each topic chunk, extract
│    Structured prompt │  candidate knowledge atoms using
│    → knowledge atoms │  the OMP schema. Use a fast model
│    with confidence   │  (Haiku-class) to keep costs low.
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 5. DEDUPLICATION     │  Semantic similarity against
│    Vector similarity │  existing atoms. >0.92 similarity
│    + entity overlap  │  = likely duplicate. Check entity
│                      │  overlap for confirmation.
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 6. CONFLICT CHECK    │  Does this contradict existing
│    Semantic +        │  knowledge? "We use Postgres"
│    logical checks    │  vs "We migrated to MySQL"
│                      │  Flag for human review.
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 7. STORE & INDEX     │  Insert atom, generate embedding,
│    Write to DB       │  update entity links, update
│    Update graph      │  knowledge graph relationships.
│    Notify if needed  │
└─────────────────────┘
```

**Extraction prompt example:**

```
You are a knowledge extraction engine. Analyze this conversation
segment and extract discrete knowledge atoms.

For each atom, provide:
- type: fact | decision | preference | solution | relationship | process | context
- content: one clear, standalone statement
- confidence: 0.0-1.0 (how certain is this knowledge?)
- entities: people, systems, technologies mentioned
- scope_suggestion: personal | team | organization

Rules:
- Only extract REUSABLE knowledge, not transient task details
- Facts must be verifiable statements, not opinions
- Decisions must include the "why" if discussed
- Solutions must be actionable
- Skip: small talk, uncertain speculation, one-time instructions
- When in doubt, don't extract (precision > recall)

Conversation segment:
{chunk}

Existing entities in this organization:
{entity_list}
```

### Context Injection (how memory enters conversations)

When a user starts or continues a conversation:

```
1. Detect topic from user's message (embedding similarity + keywords)

2. Retrieve relevant knowledge:
   - Personal atoms (user's own, top 10 by relevance)
   - Team atoms (user's team, top 10 by relevance)
   - Org atoms (company-wide, top 5 by relevance)
   - Weighted by: semantic similarity × recency × confidence × usage_score

3. Construct context preamble:
   "You have access to the following organizational context:

   [About the user]
   - Senior backend engineer, 2 years at company
   - Prefers concise answers with code examples
   - Currently working on billing service migration

   [Team knowledge]
   - Billing service is being migrated from monolith to microservice
   - Uses Stripe for payment processing, migrating to Stripe v3 API
   - Team decided on event sourcing pattern (March 2026)

   [Company knowledge]
   - Stack: Python/FastAPI backend, React frontend, PostgreSQL
   - All services must pass HIPAA compliance review
   - Deploy process: PR → CI → staging → canary → prod"

4. Inject as system message before user's first message

5. As conversation evolves, dynamically fetch more context
   if topic shifts (re-query every ~5 turns or on topic change)
```

**Critical UX detail:** Show the user what context was injected. A collapsible "Context used" panel at the top of each conversation. Users can remove irrelevant context or add more manually. This builds trust and gives them control.

---

## 2. THE ORGANIZATIONAL MEMORY PROTOCOL (OMP)

### Why a Protocol, Not Just a Feature

Every AI provider is building memory. OpenAI has memory. Claude has memory files. But they're all:
- **Siloed** — Claude's memory doesn't talk to ChatGPT's
- **Flat** — No hierarchy (personal vs. team vs. org)
- **Passive** — They remember, but don't actively manage knowledge lifecycle
- **Individual** — No concept of shared organizational knowledge

OMP is the **HTTP of AI knowledge**. A standard way to represent, exchange, and manage knowledge across any AI system.

### Three-Tier Knowledge Scoping

| Tier | Scope | Example |
|------|-------|---------|
| **Personal** | Individual user | "I prefer concise answers. I work on the billing service. I know Python well." |
| **Team** | Department/project | "Our API uses REST with JSON:API spec. We deploy on Fridays via ArgoCD. The Q2 priority is reducing churn." |
| **Company** | Organization-wide | "We're a B2B SaaS in healthcare. HIPAA compliance is mandatory. Our stack is Python/React/Postgres." |

### OMP Knowledge Atom Specification

```typescript
interface KnowledgeAtom {
  // Identity
  id: string;                    // UUID
  version: number;               // Monotonically increasing
  supersedes?: string;           // ID of previous version

  // Content
  type: 'fact' | 'decision' | 'preference' | 'solution' |
        'relationship' | 'process' | 'context';
  content: string;               // Human-readable statement
  structured?: {                 // Machine-parseable details
    entities: EntityRef[];
    conditions?: string;         // When is this true?
    action?: string;             // What to do? (for solutions/processes)
    rationale?: string;          // Why? (for decisions)
  };

  // Confidence & Lifecycle
  confidence: number;            // 0.0 - 1.0
  lifecycle: {
    created_at: ISO8601;
    last_affirmed: ISO8601;      // Last time confirmed still true
    affirmed_count: number;      // How many times confirmed
    decay_rate: number;          // 0.0 (permanent) - 1.0 (very ephemeral)
    expires_at?: ISO8601;        // Hard expiry if known
    status: 'active' | 'stale' | 'disputed' | 'archived';
  };

  // Provenance
  provenance: {
    source_type: 'conversation' | 'document' | 'manual' | 'import';
    source_id: string;
    source_model?: string;       // Which LLM was involved
    extracted_by: string;        // Which model did the extraction
    created_by: string;          // User ID
    confirmed_by?: string[];     // Users who validated
  };

  // Scope & Access
  scope: {
    level: 'personal' | 'team' | 'organization';
    owner: string;               // User or team or org ID
    visibility: 'private' | 'team' | 'organization';
    teams?: string[];            // Which teams can access
    anonymized: boolean;         // Strip attribution?
  };

  // Semantic
  embedding: number[];           // Vector for similarity search
  topics: string[];              // Topic tags
  entity_refs: EntityRef[];      // Links to knowledge graph
}

interface EntityRef {
  id: string;
  name: string;
  type: 'person' | 'system' | 'technology' | 'project' |
        'process' | 'team' | 'concept';
  relationship: string;          // "uses", "owns", "depends_on", etc.
}
```

### Knowledge Lifecycle Rules

**Decay function:**
```
effective_confidence = base_confidence × decay_factor
decay_factor = e^(-decay_rate × days_since_affirmed / 365)
```

Different atom types have different default decay rates:

| Type | Default Decay | Rationale |
|------|--------------|-----------|
| fact | 0.5 | Facts change moderately (versions, URLs, configs) |
| decision | 0.2 | Decisions are relatively stable once made |
| preference | 0.3 | Preferences evolve but slowly |
| solution | 0.6 | Solutions become outdated as systems change |
| relationship | 0.4 | People move, ownership changes |
| process | 0.7 | Processes change frequently |
| context | 0.9 | Context is highly temporal ("we're in a migration") |

**Staleness rules:**
- effective_confidence drops below 0.3 → status = 'stale', flagged for review
- Atom not retrieved in 90 days → candidate for archival
- Atom contradicted by newer atom → status = 'disputed'

### Reconciliation Engine Specification

Runs as a scheduled job (daily for active orgs, weekly for less active):

```python
# Pseudocode for reconciliation
def reconcile(org_id):
    atoms = get_active_atoms(org_id)

    # 1. Staleness sweep
    for atom in atoms:
        eff_conf = calculate_effective_confidence(atom)
        if eff_conf < 0.3:
            mark_stale(atom)
            notify_owner(atom, "This knowledge may be outdated")

    # 2. Contradiction detection
    topic_groups = group_by_topic(atoms)
    for topic, group in topic_groups:
        for a, b in combinations(group, 2):
            if semantic_similarity(a, b) > 0.7:  # Related
                if is_contradictory(a, b):        # But conflicting
                    create_conflict(a, b)
                    notify_team("Conflicting knowledge detected")

    # 3. Consolidation
    clusters = cluster_by_similarity(atoms, threshold=0.85)
    for cluster in clusters:
        if len(cluster) > 3:
            suggest_consolidation(cluster)

    # 4. Gap detection
    recent_convos = get_recent_conversations(org_id, days=7)
    unanswered = find_unanswered_questions(recent_convos, atoms)
    if unanswered:
        suggest_knowledge_gaps(unanswered)

    # 5. Trending topics
    recent_atoms = get_atoms_created_since(org_id, days=7)
    topics = extract_trending_topics(recent_atoms)
    if notable_trends(topics):
        create_weekly_digest(org_id, topics)
```

### Reconciliation Job Schedule

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Freshness decay | Daily | Reduce freshness_score of all entries by a small factor |
| Contradiction scan | Weekly | Compare entries within the same scope for semantic contradictions |
| Stale knowledge review | Weekly | Surface entries with low freshness for revalidation |
| Trending topics | Weekly | Identify frequently appearing topics in recent conversations |
| Orphan cleanup | Monthly | Archive entries that have never been injected/referenced |
| Scope promotion suggestions | Monthly | Identify personal knowledge shared by multiple team members |
| Knowledge health report | Monthly | Per-team and company-wide quality, gaps, contradictions, staleness |

### Open Protocol Strategy

**Phase 1: Internal standard.** Use OMP internally. Prove it works. Refine the spec through real usage.

**Phase 2: Publish spec.** Open-source the protocol specification (not the implementation). Write an RFC-style document.

**Phase 3: Reference implementation.** Open-source a basic OMP library (TypeScript + Python) that handles atom creation, validation, serialization, and basic storage.

**Phase 4: Ecosystem.** Encourage integrations:
- VS Code extension that emits OMP atoms from code comments/docs
- Slack bot that extracts OMP atoms from channels
- Notion/Confluence importers that convert docs to OMP atoms
- CLI tool that reads local `.knowledge/` directories (like `.git/`)

**Phase 5: Federation.** OMP atoms can be exchanged between organizations (with consent). Think: vendor shares product knowledge with client's knowledge base.

**The strategic logic:** If OMP becomes a standard, Knowledge HQ is the best OMP-native platform. Just as GitHub is the best Git platform, even though Git is open.

---

## 3. COLLABORATION LAYER

### Shared Conversations

Not just "multiple people in a chat room." Collaborative problem-solving with AI:

- **Real-time co-authoring**: Multiple users see each other's messages as they're typed. When someone sends a message to the AI, everyone sees the response stream.
- **Branching**: "I want to explore a different approach" → fork the conversation. Both branches continue independently. Can be merged back.
- **Model switching mid-conversation**: "Let's see what Claude thinks about this" → switch model, conversation context is preserved.
- **Annotations**: Team members can add comments on specific messages without polluting the AI conversation. Think Google Docs comments.

### Chat Handoffs

1. Sarah is debugging a production issue with Claude at 5pm
2. She needs to leave but the issue isn't resolved
3. She clicks "Hand off to @mike"
4. Mike gets a notification with:
   - Summary of what's been explored
   - Current hypothesis
   - What's been tried and failed
   - The full conversation history
5. Mike continues the conversation — the AI knows everything Sarah discussed

### Knowledge Sharing UX

**"Publish to Team" flow:**
1. User has a conversation where they solve a tricky problem
2. They click "Publish key findings"
3. The system extracts the core knowledge from the conversation
4. User reviews, edits, selects what to share and at what scope
5. Published knowledge appears in the team's knowledge feed
6. Team members can comment, validate, or build on it

**Knowledge Feed** (internal feed for AI learnings):
- "Sarah discovered that the Stripe webhook needs a 10s timeout for large batch payments"
- "The platform team decided to migrate from REST to gRPC for internal services"
- "New company knowledge: Our SOC2 audit is scheduled for Q3"

---

## 4. COMPANY DASHBOARD

### For Team Leads

- **Team knowledge map**: Visual graph of what the team knows, organized by topic clusters
- **Activity**: Which team members are actively using AI, on what topics
- **Knowledge gaps**: Topics where questions come up repeatedly but no knowledge exists
- **Model preferences**: Which models the team gravitates toward for different tasks

### For Company Leadership / Knowledge Officers

- **Organizational knowledge score**: Composite metric of knowledge base health
  - Coverage: What % of company domains have knowledge entries?
  - Freshness: What % of knowledge is validated within the last 30/60/90 days?
  - Consistency: How many unresolved contradictions exist?
  - Adoption: What % of employees actively contribute?

- **Knowledge flow visualization**: See how knowledge moves between teams. Identify silos.

- **Risk assessment**:
  - Bus factor: Which knowledge only lives in one person's personal scope?
  - Departing employee knowledge: When someone gives notice, highlight their unique knowledge
  - Shadow knowledge: Decisions made in AI chats that aren't documented anywhere else

- **Cost center**:
  - Total AI spend across all models
  - Spend per team, per user, per model
  - Cost trends and projections
  - ROI indicators: knowledge entries created per dollar spent

### For Compliance Officers

- **Audit trail**: Every conversation, every knowledge extraction, every access event
- **Data residency**: Where data is stored, which models process it
- **Sensitive data detection**: Automated scanning for PII, credentials, regulated data
- **Retention policies**: Auto-archive/delete after configurable periods
- **Export**: Full data export for legal/compliance reviews

---

## 5. UNIQUE FEATURES

### Feature 1: "Ask the Company"

A dedicated mode where the AI answers **only** from the organization's knowledge base.

```
User: "How do we handle customer refunds?"

[Ask the Company mode]

Based on your organization's knowledge:

1. Refunds under $100 can be processed directly by support team
   without manager approval (Decision by Sarah, March 2026,
   confidence: 0.95)

2. Refunds are processed through Stripe API using the
   /v1/refunds endpoint (Fact, confirmed by 3 team members,
   confidence: 0.98)

3. All refunds must be logged in the #refunds Slack channel
   with reason code (Process, last affirmed: 2 weeks ago,
   confidence: 0.87)
```

Zero hallucination risk because it's grounded in real organizational knowledge. Each answer has provenance and confidence.

### Feature 2: "Knowledge Replay"

Trace the evolution of any piece of knowledge through time.

```
Knowledge: "We use Stripe for payment processing"

Timeline:
├─ v1 (Jan 15): "We use PayPal for payments"
│  └─ Source: Alex's onboarding chat with Claude
├─ v2 (Feb 3): "We're evaluating Stripe vs PayPal"
│  └─ Source: Team brainstorm chat with GPT-4o
├─ v3 (Feb 20): "Decision: migrate to Stripe for lower fees"
│  └─ Source: Leadership meeting notes shared in team chat
├─ v4 (Mar 5): "Stripe integration complete, PayPal deprecated"
│  └─ Source: Mike's deployment confirmation chat
└─ Current (v4): "We use Stripe for payment processing"
   └─ Confidence: 0.97, last affirmed: 1 week ago
```

### Feature 3: "Model Arbitrage Intelligence"

The system learns which models perform best for which tasks and users.

```
Model Performance (based on user feedback & completion rates):

Code Generation:
  Claude Opus   ████████████████░░  89% satisfaction
  GPT-4o        ████████████░░░░░░  67% satisfaction
  Gemini Pro    ██████████░░░░░░░░  56% satisfaction

Strategic Analysis:
  GPT-4o        █████████████████░  94% satisfaction
  Claude Opus   ███████████████░░░  83% satisfaction
  Gemini Pro    ████████████████░░  89% satisfaction

Recommendation: Your team spends 60% of AI credits on code
generation. Switching default to Claude Opus for code tasks
would save ~$200/month and improve satisfaction by ~15%.
```

### Feature 4: "Context Handoff"

Transfer working context between team members seamlessly.

```
Sarah: "Hey @Mike, can you take over this debugging session?
        Claude has all the context on the billing API issue."

[Mike joins the conversation]

System: "Welcome Mike. Here's the context:
- Sarah identified a race condition in the billing webhook handler
- The issue occurs when two webhooks arrive within 50ms
- Claude suggested using a distributed lock with Redis
- Sarah tested the approach locally — it works
- Next step: implement in staging and run load tests

Relevant team knowledge:
- The billing webhook processes ~10,000 events/day
- Redis cluster is available at billing-redis.internal:6379
- Load testing is done via Locust (see /tests/load/)"
```

### Feature 5: "Knowledge Confidence Dashboard"

```
Engineering Knowledge Health:

████████████ Authentication    98% (12 atoms, recent, multiple sources)
████████████ Deployment        95% (8 atoms, well-documented)
████████░░░░ Billing Service   67% (5 atoms, 2 stale, 1 disputed)
████░░░░░░░░ Monitoring        33% (2 atoms, old, single source)
██░░░░░░░░░░ Incident Response 15% (1 atom, very old)
░░░░░░░░░░░░ Data Pipeline      0% (no knowledge captured)

Recommended actions:
- Review 2 stale atoms in Billing Service
- Resolve 1 conflict in Billing Service
- 8 questions about Monitoring this week with no knowledge base hits
- Data Pipeline is a blind spot — 3 team members work on it
```

### Feature 6: "Weekly Knowledge Digest"

```
Weekly Knowledge Digest — Acme Corp
March 24-30, 2026

Knowledge Growth: +47 atoms this week (+12% from last week)

Top Topics:
1. API Migration (15 new atoms) — Significant progress documenting
   the v2→v3 API migration. Key decisions around backwards compatibility.

2. Customer Onboarding (8 new atoms) — Sarah documented the complete
   onboarding flow after helping 3 new clients this week.

3. Infrastructure (6 new atoms) — Mike captured deployment procedures
   during the Kubernetes upgrade.

Conflicts Detected:
- "Deploy cadence is weekly" vs "We deploy on-demand" → Needs resolution

Knowledge Gaps:
- 5 questions about error handling conventions went unanswered
- 3 questions about the data export feature had no knowledge base hits

Trending Questions:
- "How does the rate limiter work?" (asked by 4 different people)
  → Strong candidate for a knowledge base entry
```

---

## 6. PRIVACY & TRUST

### The Privacy Contract

**Core Principle: Extract knowledge, not conversations.**

The company never sees raw chat logs. They see knowledge atoms — distilled, often anonymized facts.

| What the user said | What the company sees |
|---|---|
| "Ugh I've been stuck on this billing bug for 3 hours, my manager is going to kill me. Can you help me figure out why the Stripe webhook is failing when..." | Knowledge atom: "Stripe webhooks can fail when duplicate events arrive within 50ms. Solution: implement idempotency key check before processing." |

### Privacy Levels Per Conversation

| Mode | Knowledge Extraction | Visibility |
|------|---------------------|------------|
| **Personal** (default for personal topics) | Personal scope only | Only the user |
| **Team-Shared** (default for work topics) | Team scope enabled | Team members |
| **Company-Wide** | Company scope enabled | Organization (with permissions) |
| **Locked** | No extraction at all | Only the user, not even stored |

### User Controls
- Default privacy level in settings
- Change per conversation
- Review extracted atoms before they're shared (optional "review queue")
- Delete any atom attributed to you
- "Forget this conversation" button

### Admin Controls
- Set default privacy levels for the org
- Cannot override individual's "Personal" or "Locked" settings
- Can require that work conversations be at least "Team-Shared"
- Audit log of knowledge access

---

## 7. MVP SCOPE

### V1: "Multi-Model Chat + Personal Memory" (Weeks 1-6)

**The one-liner:** ChatGPT/Claude/Gemini in one app, and it remembers you across all of them.

Frontend (Next.js + Tailwind):
- Auth (sign up, sign in, account settings)
- Chat interface with streaming responses
- Model selector dropdown (switch mid-conversation)
- Conversation sidebar (history, search, organize)
- Memory panel (view, edit, delete personal knowledge atoms)
- Settings (API key management if BYOK, preferences)

Backend (Next.js API routes or separate service):
- Auth (NextAuth or Clerk)
- Conversation CRUD + message storage
- Model router (OpenRouter integration)
- Streaming proxy (normalize provider SSE streams)
- Basic knowledge extraction pipeline
- Context injection on new conversations
- Cost tracking per user

Database:
- Postgres on Supabase or Neon (managed, pgvector included)
- Redis for streaming state + job queue

**The "wow" moment:**
Day 1: User chats with Claude about their React project. Discusses architecture, state management, API patterns.
Day 2: User switches to GPT-4o and asks about a performance bug. GPT-4o already knows their project is React, they use Zustand, their API calls go through useApi, and they're on the dashboard component.

**NOT in V1:** Teams, collaboration, organization features, admin dashboard, reconciliation, advanced analytics.

### V2: "Teams + Shared Knowledge" (Weeks 7-10)

- Team creation and member management
- Shared conversations
- Team knowledge base (auto + manual)
- Privacy controls per conversation
- @mentions and chat handoffs
- Basic team analytics

### V3: "Organization + Knowledge Protocol" (Weeks 11-14)

- Organization-level admin dashboard
- Knowledge reconciliation engine
- Conflict detection and resolution UI
- "Ask the Company" mode
- Knowledge analytics and gap detection
- SSO (SAML/OIDC)
- Audit log and data export

### V4: "Intelligence Layer" (Weeks 15-18)

- Model recommendation engine
- Knowledge Replay
- Proactive knowledge surfacing
- Integrations (Slack, Notion, GitHub)
- API for external knowledge producers/consumers

---

## 8. BUSINESS MODEL

### Pricing

| Plan | Price | Target |
|------|-------|--------|
| **Free** | $0 | 1 user, 2 models, 50 messages/day, basic memory, 100 atoms max |
| **Pro** | $25/user/mo ($20 annual) | 1 user, all models, unlimited messages, full memory, unlimited atoms |
| **Team** | $30/user/mo ($25 annual) | Up to 25 users, shared chats, team knowledge, team analytics, 3 teams |
| **Business** | $50/user/mo ($40 annual) | Unlimited users/teams, org knowledge, reconciliation, admin dashboard, SSO |
| **Enterprise** | Custom ($80-120/user/mo) | On-prem/VPC, HIPAA/SOC2, dedicated support, SLA, advanced audit, API |

### LLM Cost Model

**Option A: Included credits (recommended for V1)**
- Each tier includes monthly AI credit allocation
- Pro: ~$15 of AI credits included
- Overage: billed at cost + 30% markup

**Option B: BYOK — Bring Your Own Keys**
- Users provide their own API keys
- Platform fee only (no AI usage markup)
- Lower price point: Pro at $10/month (platform only)

**Recommendation:** Offer both. Default to included credits. BYOK as option for power users.

### Unit Economics (per user, Team tier)

```
Revenue:                    $30/month
AI usage cost (avg):       -$8/month
Infrastructure:            -$2/month
Knowledge extraction cost: -$1/month
                           ─────────
Gross margin:              $19/month  (63%)
```

### Revenue Expansion
- Knowledge API access (programmatic access to knowledge base)
- Advanced analytics (premium dashboards)
- Model fine-tuning on company's knowledge base
- Compliance add-ons (audit trails, data residency, retention)

### Key Metrics
- NDR (Net Dollar Retention): Target >120%
- Knowledge entries per user per week (engagement)
- Knowledge injection hit rate (% of conversations where injected knowledge was relevant)
- Time to first knowledge entry (onboarding health)
- Organic model switch rate (validates multi-model thesis)

---

## 9. GO-TO-MARKET STRATEGY

### Target Customer Profile (Early)
- 20-200 employees
- Tech-forward (already using multiple AI tools)
- Knowledge-intensive work (consulting, engineering, research, legal, marketing)
- Pain: "Our team uses 4 different AI tools and nothing connects"
- Budget holder: CTO, VP Engineering, Head of Operations

### Phase 1: Creator-Led Growth (Month 1-6)

Target: AI power users who already juggle 3+ AI subscriptions.

Channels:
- **Product Hunt** — launch with strong demo video showing cross-model memory
- **Twitter/X** — daily content showing unique capabilities
- **YouTube** — "I replaced 4 AI apps with one" style content
- **Hacker News** — technical deep-dive on the OMP protocol
- **Reddit** — r/ChatGPT, r/LocalLLaMA, r/artificial, r/SaaS

### Phase 2: Community + Teams (Month 7-12)

- Discord community for power users
- Case studies: "How [Company X] reduced onboarding time by 40%"
- AI newsletter partnerships
- Referral program: "Invite your team, get 1 month free"

### Phase 3: Enterprise (Month 13+)

- SOC 2 Type II certification
- Sales team (2-3 AEs focused on mid-market)
- IT consulting firm partnerships
- Conference presence
- White papers on organizational AI memory

### Growth Projections

```
Month 1-6:   Individual users
             Target: 10,000 free, 1,000 Pro
             MRR: $25,000

Month 7-12:  Teams launch
             Target: 500 teams (avg 5 users), 3,000 Pro
             MRR: $150,000

Month 13-18: Business tier
             Target: 100 companies (avg 20 users), 1000 teams
             MRR: $500,000

Month 19-24: Enterprise push
             Target: 20 enterprise (avg 100 users)
             MRR: $1,200,000
```

---

## 10. COMPETITIVE LANDSCAPE

### Competitive Matrix

| Feature | Knowledge HQ | Dust.tt | Glean | Poe | TypingMind | ChatGPT Teams |
|---------|-----------|---------|-------|-----|------------|--------------|
| Multi-model | Yes | Yes | No | Yes | Yes | No |
| Personal memory | Yes | No | No | No | Basic | Basic |
| Team knowledge | Yes | Yes | Yes | No | No | Basic |
| Org knowledge | Yes | Yes | Yes | No | No | No |
| Auto-extraction | Yes | No | No | No | No | No |
| Knowledge lifecycle | Yes | No | No | No | No | No |
| Chat-first UX | Yes | No | No | Yes | Yes | Yes |
| Shared chats | Yes | No | No | No | No | Yes |
| Knowledge graph | Yes | No | Yes | No | No | No |
| Open protocol | Yes | No | No | No | No | No |
| SMB friendly | Yes | No | No | Yes | Yes | Yes |

### Positioning Against Each

**Dust.tt:** "Dust indexes what you already know. Knowledge HQ grows what you know with every conversation."

**Glean:** "Glean searches your past. Knowledge HQ builds your future." (Complementary — Glean integration is a future feature.)

**Poe:** "Poe gives you access to models. Knowledge HQ gives you access to models that know you."

**TypingMind:** "TypingMind is a better chat client. Knowledge HQ is a knowledge platform."

**ChatGPT/Claude Teams:** "Why bet on one model when you can have all of them — and keep the knowledge regardless of which provider you use?"

### Defensibility

1. **Network effects**: Each user's contributions make the knowledge base better for everyone
2. **Switching costs**: After 6 months, thousands of knowledge entries. Migration is painful.
3. **Data advantage**: More conversations → better extraction models → better product
4. **Protocol standard**: If OMP becomes the standard, Knowledge HQ owns the protocol

### Biggest Risk
A model provider builds "good enough" team features and companies stay siloed. **Mitigation:** Make multi-model value so clear that single-model lock-in feels unacceptable.

---

## 11. CRITICAL DESIGN DECISIONS

### The Cold Start Problem

Day 1, the knowledge base is empty. Solutions:

1. **Import existing knowledge** — Connect Notion, Confluence, Google Docs, Slack channels, existing AI chat exports
2. **Smart onboarding** — Ask 5-10 questions per user and admin ("What's your role?" "What's your stack?")
3. **Aggressive extraction in week 1** — Lower confidence threshold, show "confirm/reject" UI
4. **Templates** — Pre-built knowledge templates by industry (SaaS Startup, Healthcare, etc.)

### Multi-Model UX

Three approaches:
1. **Manual selection:** User picks model per conversation/message (V1)
2. **Smart default:** System suggests model based on task type, with override (V2)
3. **Auto-routing:** System picks best model per message (V3+)

**Mid-conversation model switching** is a unique killer feature. Switch from Claude to GPT mid-thread for a "second opinion" — context carries over through conversation history.

---

## 12. TECHNICAL RISKS AND MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|------------|
| Knowledge extraction quality — noise overwhelms signal | High | Multi-model validation, confidence thresholds, human review, feedback mechanism, continuous improvement |
| Context window saturation — too much knowledge injected | High | Smart retrieval (top-k), compression/summarization, user control over context size, dynamic re-retrieval |
| Cost management — extraction pipeline gets expensive | Medium | Cheap models for extraction (Haiku-class), batch processing, extract only substantial conversations (>5 turns), caching |
| Privacy breach — personal knowledge leaks to company | Critical | Strict scope enforcement (row-level security), "locked" mode, review queue, audit logs, penetration testing |
| Provider dependency — API changes break things | Medium | Abstraction layer, direct API fallbacks, provider health monitoring, automatic failover |
| Knowledge graph scale — millions of atoms | Low (initially) | Hierarchical summarization, archival, topic-based partitioning, eventual graph DB migration |
| User adoption — "another tool" resistance | High | Free tier, import existing chats, demonstrate cross-model memory magic, zero behavior change required |
| Stale knowledge poisoning | Medium | Decay function, staleness flags, reconciliation engine, user feedback, automatic confidence reduction |

---

## 13. PRODUCT ROADMAP — 12 MONTHS

```
Q1 2026: FOUNDATION
├── Month 1-2: Core chat + multi-model routing
│   ├── Auth, multi-tenant DB, streaming chat
│   ├── OpenRouter integration (all major models)
│   ├── Conversation management, search, organize
│   └── Model switching (per-conversation, mid-conversation)
├── Month 3: Personal Memory
│   ├── Knowledge extraction pipeline v1
│   ├── Context injection on new conversations
│   ├── Memory management UI (view, edit, delete)
│   └── "Magic moment" polish — cross-model memory demo
└── LAUNCH: Product Hunt, HN, Twitter

Q2 2026: TEAMS
├── Month 4: Team Foundations
│   ├── Team CRUD, invitations, roles
│   ├── Shared conversations (invite, join, leave)
│   ├── Team knowledge base (auto + manual)
│   └── Privacy controls (per-conversation visibility)
├── Month 5: Collaboration
│   ├── @mentions and notifications
│   ├── Context handoff between team members
│   ├── Team knowledge search
│   └── Basic team analytics
├── Month 6: Knowledge Intelligence
│   ├── Reconciliation engine v1 (staleness, conflicts)
│   ├── "Ask the Company" mode
│   └── Knowledge confidence indicators
└── MILESTONE: First paying teams

Q3 2026: ORGANIZATION
├── Month 7: Admin & Compliance
│   ├── Organization dashboard
│   ├── Usage analytics and cost management
│   ├── SSO (SAML/OIDC)
│   └── Audit logs and data export
├── Month 8: Knowledge Protocol
│   ├── OMP specification v1.0 published
│   ├── Knowledge Replay feature
│   ├── Gap detection and recommendations
│   └── Weekly knowledge digest
├── Month 9: Integrations
│   ├── Slack integration (knowledge extraction from channels)
│   ├── Notion/Confluence import
│   ├── GitHub integration (PR context, code knowledge)
│   └── API for external knowledge producers
└── MILESTONE: First enterprise pilot

Q4 2026: SCALE
├── Month 10: Intelligence
│   ├── Model arbitrage recommendations
│   ├── Smart model routing (auto-suggest best model)
│   ├── Advanced knowledge analytics
│   └── Knowledge graph visualization
├── Month 11: Enterprise
│   ├── SOC 2 Type II certification process
│   ├── HIPAA compliance option
│   ├── VPC deployment option
│   └── Enterprise sales tooling
├── Month 12: Ecosystem
│   ├── OMP SDK (TypeScript + Python)
│   ├── VS Code extension
│   ├── Browser extension (save web content as knowledge)
│   └── Mobile app (read-only initially)
└── MILESTONE: $500K+ ARR
```

---

## 14. TEAM & HIRING PRIORITIES

| Role | Why | When |
|------|-----|------|
| Full-stack engineer (founder + 1-2) | Build core chat + memory product | Day 1 |
| ML/NLP engineer | Knowledge extraction quality, embeddings, retrieval | Month 2-3 |
| Designer | UX of knowledge management is hard. Bad UX = no adoption | Month 1-2 |
| DevOps/Infra | Multi-tenant, multi-region, secure infrastructure | Month 3-4 |
| Growth/marketing | Content marketing, PLG optimization | Month 4-6 |
| Enterprise sales (1-2 AEs) | Mid-market and enterprise deals | Month 10+ |

---

## 15. THE KILLER INSIGHT

Every company is sitting on a goldmine of knowledge being generated daily through AI conversations — and it's evaporating into thin air.

**The analogy:** Before Salesforce, every salesperson had their own Rolodex. Customer knowledge lived in individual notebooks and heads. When someone left, the knowledge walked out the door. Salesforce said: "What if customer knowledge belonged to the company?"

Knowledge HQ is the same inflection point for AI-generated knowledge. Right now, every employee's AI conversations are their personal Rolodex. When they leave (or just switch tools), the knowledge vanishes. Knowledge HQ says: **"What if AI knowledge belonged to the organization?"**

The timing is perfect:
- AI usage is exploding across enterprises (90%+ of knowledge workers use AI weekly)
- Multi-model is the norm (no company bets on one provider)
- No one owns the "organizational AI memory" space
- The open protocol play creates a standards-setting opportunity

The moat deepens with every conversation. After 6 months, a company's Knowledge HQ knowledge base is irreplaceable — it contains thousands of decisions, solutions, and facts that exist nowhere else. That's the ultimate switching cost.
