# Knowledge HQ

**Your team's HQ for knowledgee.** Chat with GPT-4o, Claude, Gemini, Grok, and Llama in one place. Every conversation builds your organization's knowledge base -- automatically extracted, always available, compounding with every chat.

**Live:** [knowledgee-olive.vercel.app](https://knowledgee-olive.vercel.app)

---

## The Problem

Companies use multiple AI tools (ChatGPT, Claude, Gemini, Grok) but knowledge is fragmented:
- Chats are isolated between LLMs -- context doesn't transfer
- Companies have no access to knowledge employees generate in AI conversations
- When employees leave, their AI-generated knowledge walks out the door
- This is the **"shadow AI" problem** -- the AI equivalent of shadow IT

## The Solution

Knowledge HQ captures knowledge from every AI conversation and makes it available across the organization:

1. **Chat naturally** with any AI model
2. **Knowledge is extracted** automatically (facts, decisions, solutions, relationships)
3. **Context compounds** -- future conversations include relevant knowledge from all previous ones

## Features

### Multi-Model Chat
- 10 models across 5 providers (OpenAI, Anthropic, Google, xAI, Meta)
- Switch models mid-conversation
- Model indicator per message
- Streaming responses with markdown rendering

### Organizational Memory Protocol (OMP)
- Auto-extraction of knowledge atoms (facts, decisions, preferences, solutions, relationships, processes, context)
- Three-tier scoping: Personal -> Team -> Company
- pgvector semantic search for context injection
- Knowledge Replay: version timeline showing how knowledge evolved
- Confidence scoring with exponential decay per atom type
- Deduplication via vector similarity (>0.92 affirms, 0.80-0.92 creates new version)

### Team Collaboration
- Create teams and invite members by email
- Share knowledge atoms (promote personal -> team scope)
- Shared conversations visible to team members
- "Ask the Company" mode -- AI answers only from the knowledge base with citations

### Knowledge Intelligence
- Reconciliation engine: staleness decay, contradiction detection, conflict resolution
- Health dashboard: score, confidence metrics, topic distribution
- Gap detection: AI identifies missing knowledge areas
- Weekly digest: AI-generated summary of knowledge growth

### Enterprise Ready
- Audit logging (user actions, knowledge access, data exports)
- Data export (full JSON download of all conversations + knowledge)
- Conversation import (ChatGPT export format)
- BYOK API key management per provider
- Organization auto-creation on registration

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Neon Postgres + pgvector
- **ORM:** Drizzle ORM
- **Auth:** NextAuth v5 (credentials provider, JWT sessions)
- **AI:** Vercel AI SDK + OpenRouter + direct provider APIs
- **State:** Zustand (persisted)
- **Deployment:** Vercel

## Architecture

```
Browser -> Vercel Edge -> Next.js API Routes
                          |-- /api/auth/*              NextAuth + Neon
                          |-- /api/chat                AI SDK streaming + vector search
                          |-- /api/chat/title          AI title generation
                          |-- /api/conversations/*     Neon CRUD
                          |-- /api/knowledge/extract   Haiku extraction + embeddings
                          |-- /api/knowledge/search    pgvector cosine similarity
                          |-- /api/knowledge/ask       Knowledge-only answers
                          |-- /api/knowledge/reconcile Decay + contradiction detection
                          |-- /api/knowledge/stats     Health metrics
                          |-- /api/knowledge/gaps      AI gap analysis
                          |-- /api/knowledge/digest    Weekly AI summary
                          |-- /api/teams/*             Team management
                          |-- /api/analytics           Usage metrics
                          |-- /api/audit               Audit trail
                          |-- /api/export              Data download
                          |-- /api/import              ChatGPT import
                          |-- /api/models/suggest      Smart model routing
                          +-- /api/onboarding          Knowledge seeding

Neon Postgres (pgvector):
  users, organizations, teams, team_members
  conversations, messages, conversation_participants
  knowledge_atoms (+ vector embeddings), knowledge_entities
  knowledge_conflicts, knowledge_retrievals
  model_usage, audit_log
```

## Getting Started

### Prerequisites
- Node.js 18+
- A [Neon](https://neon.tech) database
- At least one AI provider API key (Anthropic recommended)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd knowledgee
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your database URL and API keys

# Push database schema
npx drizzle-kit push

# Run locally
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `AUTH_SECRET` | Yes | Random secret for NextAuth sessions |
| `ANTHROPIC_API_KEY` | Recommended | For Claude models + knowledge extraction |
| `OPENROUTER_API_KEY` | Optional | Fallback for all models via OpenRouter |
| `OPENAI_API_KEY` | Optional | For GPT models directly |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | For Gemini models |
| `XAI_API_KEY` | Optional | For Grok models |
| `EXTRACTION_MODEL` | Optional | Model for knowledge extraction (default: claude-haiku) |

### Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add ANTHROPIC_API_KEY production
# ... add other env vars
vercel --prod
```

## API Reference

**28 API routes** across 8 domains:

| Domain | Routes | Description |
|--------|--------|-------------|
| Auth | 2 | Register, NextAuth handlers |
| Chat | 2 | Streaming chat, title generation |
| Conversations | 4 | CRUD, messages, full-text search |
| Knowledge | 10 | Extract, search, ask, atoms, promote, history, reconcile, stats, gaps, digest |
| Teams | 3 | CRUD, members, invite |
| Analytics | 1 | Usage metrics + cost tracking |
| Infrastructure | 4 | Audit, export, import, onboarding |
| Models | 1 | Smart suggestions |

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | 81 |
| Lines of code | ~9,000 |
| API routes | 28 |
| Pages | 7 |
| Database tables | 13 |
| AI models | 10 |

## License

Private -- all rights reserved.
