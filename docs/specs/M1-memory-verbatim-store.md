# M1 — Memory Rebuild on the Verbatim Store

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the extracted-atom storage model with a verbatim source-chunk store, hybrid retrieval (semantic + lexical + entity), cross-encoder reranking, bi-temporal facts, embedding versioning, and Postgres row-level security — proving retrieval recall@5 ≥ 0.75 on the LongMemEval single-user subset and demonstrating database-enforced cross-tenant isolation.

**Architecture:** New tables `sources`, `source_chunks`, `memory_atoms_v2`, `memory_entities`, `memory_snapshots` live alongside legacy `knowledge_atoms` until cutover. Every chat turn, document, interview, and crawl page becomes a `sources` row; chunks land in `source_chunks` with embedding (versioned), tsvector, valid_at/invalid_at, and entity links. Retrieval unions semantic (pgvector HNSW), lexical (Postgres FTS), and entity-direct candidates, then reranks via Cohere/Voyage. RLS keys off `app.current_org_id` set per request. Extraction pipeline moves from sync HTTP to Vercel Queues. Cron jobs (`vercel.ts`) drive the daily/weekly evolution loop.

**Tech Stack:** Next.js 16, Drizzle ORM, Neon Postgres + pgvector + pg_trgm, Vercel AI Gateway (embeddings), Vercel Queues, Vercel Cron, Cohere Rerank 3 (or Voyage rerank-2.5), Vitest for unit tests, raw SQL for the LongMemEval runner.

---

## File Structure

**New files (created in this milestone):**

| Path | Responsibility |
|---|---|
| `drizzle/0006_memory_verbatim.sql` | Schema migration: new tables, indexes (HNSW + GIN), pg_trgm extension, RLS policies, triggers for tsvector + temporal coherence |
| `src/lib/db/tenant.ts` | `withTenant(orgId, fn)` helper — opens a tx, `SET LOCAL app.current_org_id`, runs work |
| `src/lib/memory/types.ts` | TypeScript types for `SourceRow`, `ChunkRow`, `AtomRow`, `EntityRow`, `RetrievalCandidate`, `RetrievalResult` |
| `src/lib/memory/embed.ts` | `embed(text)` returning `{vector, version}`; `currentEmbeddingVersion` constant; backed by Vercel AI Gateway |
| `src/lib/memory/chunker.ts` | `chunkText(content, opts)` — sliding window with overlap, respects markdown/sentence boundaries |
| `src/lib/memory/ingest.ts` | `ingestSource({orgId, type, ownerUserId, title, chunks, meta})` — writes source + chunks, queues entity extraction + projection |
| `src/lib/memory/retrieve.ts` | `retrieve({query, scope, limit, asOf?})` — hybrid signals + rerank, returns ranked chunks with provenance |
| `src/lib/memory/rerank.ts` | `rerank(query, candidates)` — Cohere/Voyage cross-encoder, falls back to weighted-RRF when no API key |
| `src/lib/memory/entities.ts` | `extractEntities(chunks)` — Sonnet-Haiku NER pass; `linkEntity(name, type, orgId)` — fuzzy + embedding dedupe |
| `src/lib/memory/projection.ts` | `projectAtoms(orgId, scopeUserId, since)` — cluster recent chunks (kmeans++ over embeddings, k = sqrt(n/2)), summarize each cluster into an atom, supersede/affirm/insert |
| `src/lib/memory/queue.ts` | `enqueueExtraction(sourceId)`, `enqueueProjection(orgId, scopeId)` — Vercel Queues producers |
| `src/lib/memory/cron/affirmation.ts` | Daily: increment affirmed_count for atoms whose source chunks were retrieved successfully in the last 24h |
| `src/lib/memory/cron/drift.ts` | Daily: apply decay; mark stale below threshold |
| `src/lib/memory/cron/disagreement.ts` | Weekly: detect supersession candidates via similarity + temporal ordering; archive losers |
| `src/lib/memory/cron/consolidation.ts` | Weekly: cluster near-duplicate atoms; merge with attribution preserved |
| `src/lib/memory/cron/health.ts` | Weekly: per-org metrics → `memory_snapshots` |
| `src/app/api/queue/extract/route.ts` | Queue consumer: NER + projection refresh for an enqueued source |
| `src/app/api/queue/project/route.ts` | Queue consumer: projection refresh for an org+scope |
| `src/app/api/cron/[job]/route.ts` | Cron entry point dispatching to the right handler |
| `vercel.ts` | Vercel project config — cron schedule + queue bindings |
| `evals/longmemeval/data.ts` | Fetch + cache LongMemEval-S subset (200 tasks) |
| `evals/longmemeval/run.ts` | Runner: ingest sessions, run retrieval, compute recall@5 |
| `evals/longmemeval/judge.ts` | LLM-based correctness scorer for the answer-quality slice |
| `package.json` | Add scripts: `eval:longmemeval`, `test`, `test:watch`; deps: `vitest`, `@vitest/coverage-v8`, `cohere-ai` (or `voyageai`) |
| `vitest.config.ts` | Vitest configuration |

**Modified files:**

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | Add Drizzle definitions for `sources`, `sourceChunks`, `memoryAtoms` (new), `memoryEntities`, `memorySnapshots`, `entityLinks`. Keep legacy `knowledgeAtoms` for now |
| `src/lib/db/index.ts` | Export `withTenant` helper |
| `src/app/api/chat/route.ts` | Replace `searchKnowledgeByVector` with `retrieve()`. After streaming completes, queue ingestion of the turn into source_chunks |
| `src/app/api/knowledge/extract/route.ts` | Replace inline extraction with `enqueueExtraction()` |
| `src/app/api/knowledge/ask/route.ts` | Replace `searchKnowledgeByVector` with `retrieve()` (knowledge-only mode = stricter scoring) |
| `src/lib/knowledge/db-store.ts` | Mark `searchKnowledgeByVector` deprecated; keep working until cutover validated |

**Files deleted at end of milestone (final cutover task):**

- `src/lib/knowledge/embeddings.ts` (replaced by `src/lib/memory/embed.ts`)
- Legacy `searchKnowledgeByText` in `db-store.ts`

---

## Task 1: Add test infrastructure (Vitest)

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
cd /Users/gui/Desktop/knowledgee
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 3: Write `tests/setup.ts`**

```ts
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env.test', override: true });
```

- [ ] **Step 4: Add scripts to `package.json`**

In `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
describe('vitest', () => { it('runs', () => expect(1+1).toBe(2)); });
```

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/setup.ts tests/smoke.test.ts package.json package-lock.json
git commit -m "chore(test): add vitest"
```

---

## Task 2: Schema migration — new memory tables

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0006_memory_verbatim.sql` (after `drizzle-kit generate`)

- [ ] **Step 1: Add Drizzle definitions to `src/lib/db/schema.ts`**

Append after the existing `knowledgeRetrievals` definition:

```ts
// ============================================================
// Verbatim source store (M1)
// ============================================================

export const sourceTypeEnum = pgEnum('source_type', [
  'conversation', 'document', 'interview', 'crawl',
]);

export const sourceStatusEnum = pgEnum('source_status', [
  'active', 'archived', 'deleted',
]);

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  type: sourceTypeEnum('type').notNull(),
  title: varchar('title', { length: 500 }),
  status: sourceStatusEnum('status').notNull().default('active'),
  meta: jsonb('meta').default({}),
  validAt: timestamp('valid_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('sources_org_idx').on(t.orgId),
  index('sources_owner_idx').on(t.ownerUserId),
  index('sources_type_idx').on(t.type),
]);

export const sourceChunks = pgTable('source_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  ord: integer('ord').notNull(),
  role: varchar('role', { length: 32 }),                  // 'user' | 'assistant' | null
  speakerUserId: uuid('speaker_user_id').references(() => users.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  embeddingVersion: integer('embedding_version').notNull().default(1),
  // embedding vector(1536) — added via raw SQL in the migration below
  // tsv tsvector — added via raw SQL in the migration below
  meta: jsonb('meta').default({}),
  validAt: timestamp('valid_at').defaultNow().notNull(),
  invalidAt: timestamp('invalid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('chunks_source_idx').on(t.sourceId),
  index('chunks_org_idx').on(t.orgId),
  index('chunks_speaker_idx').on(t.speakerUserId),
  index('chunks_valid_idx').on(t.validAt),
]);

export const memoryAtoms = pgTable('memory_atoms', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  scopeUserId: uuid('scope_user_id').references(() => users.id, { onDelete: 'cascade' }),
  scopeTeamId: uuid('scope_team_id').references(() => teams.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 32 }).notNull(),        // 'fact' | 'decision' | 'preference'
  content: text('content').notNull(),
  confidence: real('confidence').notNull().default(0.7),
  affirmedCount: integer('affirmed_count').notNull().default(1),
  lastAffirmed: timestamp('last_affirmed').defaultNow().notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'), // active | stale | superseded
  supersedesId: uuid('supersedes_id'),
  validAt: timestamp('valid_at').defaultNow().notNull(),
  invalidAt: timestamp('invalid_at'),
  // embedding vector(1536) — raw SQL
  sourceIds: jsonb('source_ids').notNull().default([]),   // uuid[]
  topics: jsonb('topics').notNull().default([]),          // string[]
  embeddingVersion: integer('embedding_version').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('atoms_org_idx').on(t.orgId),
  index('atoms_scope_user_idx').on(t.scopeUserId),
  index('atoms_scope_team_idx').on(t.scopeTeamId),
  index('atoms_status_idx').on(t.status),
]);

export const memoryEntities = pgTable('memory_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  canonicalName: varchar('canonical_name', { length: 255 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),        // person | customer | product | competitor | concept
  // embedding vector(1536) — raw SQL
  mentionCount: integer('mention_count').notNull().default(0),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  meta: jsonb('meta').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('entities_org_idx').on(t.orgId),
  index('entities_canonical_idx').on(t.orgId, t.canonicalName),
]);

export const entityLinks = pgTable('entity_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  entityId: uuid('entity_id').references(() => memoryEntities.id, { onDelete: 'cascade' }).notNull(),
  chunkId: uuid('chunk_id').references(() => sourceChunks.id, { onDelete: 'cascade' }),
  atomId: uuid('atom_id').references(() => memoryAtoms.id, { onDelete: 'cascade' }),
  relationship: varchar('relationship', { length: 64 }).notNull().default('mentioned_in'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('elinks_entity_idx').on(t.entityId),
  index('elinks_chunk_idx').on(t.chunkId),
  index('elinks_atom_idx').on(t.atomId),
]);

export const memorySnapshots = pgTable('memory_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  computedAt: timestamp('computed_at').defaultNow().notNull(),
  nodes: jsonb('nodes').notNull(),
  edges: jsonb('edges').notNull(),
  contributorWeights: jsonb('contributor_weights').notNull(),
  topicClusters: jsonb('topic_clusters').notNull(),
}, (t) => [
  index('snapshots_org_idx').on(t.orgId, t.computedAt),
]);
```

- [ ] **Step 2: Generate the Drizzle migration**

```bash
npx drizzle-kit generate --name memory_verbatim
```

This creates `drizzle/0006_memory_verbatim.sql` (or next available number). Inspect it.

- [ ] **Step 3: Append raw SQL to the generated migration**

Open `drizzle/0006_memory_verbatim.sql`. Append at the bottom:

```sql
-- Required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Vector + tsvector columns
ALTER TABLE source_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE source_chunks ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
ALTER TABLE memory_atoms ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE memory_entities ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Indexes
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
  ON source_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_tsv_gin
  ON source_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS atoms_embedding_hnsw
  ON memory_atoms USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS entities_embedding_hnsw
  ON memory_entities USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS entities_name_trgm
  ON memory_entities USING gin (name gin_trgm_ops);
```

- [ ] **Step 4: Push schema**

```bash
npx drizzle-kit push
```

Expected: no errors; `\d source_chunks` in psql shows `embedding`, `tsv`, indexes.

- [ ] **Step 5: Smoke test against the DB**

Create `tests/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

describe('M1 schema', () => {
  it('has source_chunks with embedding + tsv', async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'source_chunks' AND column_name IN ('embedding','tsv')
    `);
    expect(result.rows.length).toBe(2);
  });

  it('has HNSW index on chunks embedding', async () => {
    const result = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'source_chunks' AND indexname = 'chunks_embedding_hnsw'
    `);
    expect(result.rows.length).toBe(1);
  });
});
```

Run: `npm test -- tests/db/schema.test.ts`
Expected: PASS (requires `DATABASE_URL` in `.env.local`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/ tests/db/schema.test.ts
git commit -m "feat(memory): add verbatim store schema (sources, chunks, atoms, entities, snapshots)"
```

---

## Task 3: Postgres Row-Level Security policies

**Files:**
- Create: `drizzle/0007_rls.sql`

- [ ] **Step 1: Write the RLS migration**

Create `drizzle/0007_rls.sql`:

```sql
-- Enable RLS on every tenanted table
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_atoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_snapshots ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy keyed off app.current_org_id GUC.
-- The GUC is set by withTenant() before every query. Service-role
-- bypasses (admin / cron) explicitly skip RLS via SET ROLE.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sources', 'source_chunks', 'memory_atoms',
    'memory_entities', 'entity_links', 'memory_snapshots'
  ]
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS tenant_isolation ON %I;
      CREATE POLICY tenant_isolation ON %I
        USING (org_id = current_setting('app.current_org_id', true)::uuid)
        WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
    $f$, t, t);
  END LOOP;
END $$;

-- A bypass role for cron + admin operations (we set this explicitly)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'osmer_service') THEN
    CREATE ROLE osmer_service NOBYPASSRLS;
  END IF;
END $$;

ALTER ROLE osmer_service BYPASSRLS;
```

- [ ] **Step 2: Apply the migration**

```bash
psql "$DATABASE_URL" -f drizzle/0007_rls.sql
```

Expected: no errors. Verify:

```bash
psql "$DATABASE_URL" -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('sources','source_chunks','memory_atoms','memory_entities','entity_links','memory_snapshots');"
```

All six should show `relrowsecurity = t`.

- [ ] **Step 3: Commit**

```bash
git add drizzle/0007_rls.sql
git commit -m "feat(db): row-level security on tenant-scoped memory tables"
```

---

## Task 4: Tenant context helper

**Files:**
- Create: `src/lib/db/tenant.ts`
- Create: `tests/db/tenant.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/db/tenant.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';
import { sources, organizations } from '@/lib/db/schema';

describe('withTenant', () => {
  it('isolates queries to the configured org', async () => {
    // Set up: two orgs, one source each
    const [orgA] = await db.insert(organizations).values({ name: 'A', slug: `t-a-${Date.now()}` }).returning();
    const [orgB] = await db.insert(organizations).values({ name: 'B', slug: `t-b-${Date.now()}` }).returning();
    await db.insert(sources).values({ orgId: orgA.id, type: 'conversation', title: 'A-only' });
    await db.insert(sources).values({ orgId: orgB.id, type: 'conversation', title: 'B-only' });

    const visibleA = await withTenant(orgA.id, async (tx) => {
      return tx.execute(sql`SELECT title FROM sources`);
    });
    const titles = (visibleA.rows as Array<{ title: string }>).map(r => r.title);
    expect(titles).toContain('A-only');
    expect(titles).not.toContain('B-only');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/db/tenant.test.ts
```

Expected: FAIL — `withTenant` not defined.

- [ ] **Step 3: Implement `withTenant`**

Create `src/lib/db/tenant.ts`:

```ts
import { db } from './index';
import { sql } from 'drizzle-orm';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run a database operation under a tenant context. Sets
 * `app.current_org_id` on a transaction so RLS policies enforce
 * cross-tenant isolation. Throws if orgId is empty.
 */
export async function withTenant<T>(
  orgId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!orgId) throw new Error('withTenant: orgId required');
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return fn(tx);
  });
}
```

- [ ] **Step 4: Re-run the test**

```bash
npm test -- tests/db/tenant.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/tenant.ts tests/db/tenant.test.ts
git commit -m "feat(db): withTenant helper for RLS-bound queries"
```

---

## Task 5: Memory types

**Files:**
- Create: `src/lib/memory/types.ts`

- [ ] **Step 1: Define shared types**

Create `src/lib/memory/types.ts`:

```ts
export type SourceType = 'conversation' | 'document' | 'interview' | 'crawl';

export interface SourceRow {
  id: string;
  orgId: string;
  ownerUserId: string | null;
  type: SourceType;
  title: string | null;
  status: 'active' | 'archived' | 'deleted';
  meta: Record<string, unknown>;
  validAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkRow {
  id: string;
  sourceId: string;
  orgId: string;
  ord: number;
  role: 'user' | 'assistant' | null;
  speakerUserId: string | null;
  content: string;
  tokenCount: number | null;
  embeddingVersion: number;
  meta: Record<string, unknown>;
  validAt: Date;
  invalidAt: Date | null;
  createdAt: Date;
}

export type AtomType = 'fact' | 'decision' | 'preference';
export type AtomStatus = 'active' | 'stale' | 'superseded';

export interface AtomRow {
  id: string;
  orgId: string;
  scopeUserId: string | null;
  scopeTeamId: string | null;
  type: AtomType;
  content: string;
  confidence: number;
  affirmedCount: number;
  lastAffirmed: Date;
  status: AtomStatus;
  supersedesId: string | null;
  validAt: Date;
  invalidAt: Date | null;
  sourceIds: string[];
  topics: string[];
  embeddingVersion: number;
}

export interface RetrievalCandidate {
  chunkId: string;
  sourceId: string;
  content: string;
  signal: 'semantic' | 'lexical' | 'entity';
  rawScore: number;       // signal-specific
  speakerUserId: string | null;
  validAt: Date;
  meta: Record<string, unknown>;
}

export interface RetrievalResult {
  chunkId: string;
  sourceId: string;
  content: string;
  finalScore: number;     // post-rerank
  signals: Array<{ kind: 'semantic' | 'lexical' | 'entity'; score: number }>;
  speakerUserId: string | null;
  validAt: Date;
  meta: Record<string, unknown>;
}

export interface RetrievalScope {
  userId: string;
  teamIds: string[];
  orgId: string;
  includeOrg: boolean;
}

export interface IngestRequest {
  orgId: string;
  type: SourceType;
  ownerUserId: string | null;
  title?: string;
  meta?: Record<string, unknown>;
  chunks: Array<{
    ord: number;
    content: string;
    role?: 'user' | 'assistant' | null;
    speakerUserId?: string | null;
    meta?: Record<string, unknown>;
  }>;
  sourceId?: string;       // pass to upsert (for conversation = id is conversation id)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/memory/types.ts
git commit -m "feat(memory): shared type definitions"
```

---

## Task 6: Embedding service with versioning

**Files:**
- Create: `src/lib/memory/embed.ts`
- Create: `tests/memory/embed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/memory/embed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { embed, currentEmbeddingVersion, EMBEDDING_DIM } from '@/lib/memory/embed';

describe('embed', () => {
  it('returns a 1536-dim vector with the current version', async () => {
    const { vector, version } = await embed('Acme uses Stripe for payments');
    expect(vector.length).toBe(EMBEDDING_DIM);
    expect(version).toBe(currentEmbeddingVersion);
    expect(vector.every(n => typeof n === 'number')).toBe(true);
  });

  it('produces stable embeddings for the same input', async () => {
    const a = await embed('hello world');
    const b = await embed('hello world');
    // Cosine similarity ~1
    const dot = a.vector.reduce((s, v, i) => s + v * b.vector[i], 0);
    expect(dot).toBeGreaterThan(0.99);
  });
});
```

- [ ] **Step 2: Run test (will fail)**

```bash
npm test -- tests/memory/embed.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement embed**

Create `src/lib/memory/embed.ts`:

```ts
import { embed as aiEmbed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export const EMBEDDING_DIM = 1536;
export const currentEmbeddingVersion = 1;

const EMBEDDING_MODEL_BY_VERSION: Record<number, string> = {
  1: 'openai/text-embedding-3-small',
};

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseURL: 'https://openrouter.ai/api/v1',
});

export interface EmbedResult {
  vector: number[];
  version: number;
}

export async function embed(text: string, version: number = currentEmbeddingVersion): Promise<EmbedResult> {
  const modelId = EMBEDDING_MODEL_BY_VERSION[version];
  if (!modelId) throw new Error(`unknown embedding version ${version}`);
  const { embedding } = await aiEmbed({
    model: openrouter.embedding(modelId),
    value: text.slice(0, 8000), // safety cap
  });
  return { vector: embedding, version };
}

export async function embedBatch(texts: string[]): Promise<EmbedResult[]> {
  // text-embedding-3-small supports batch via the AI SDK embedMany when needed.
  // For M1 we serialize; revisit if throughput becomes a bottleneck.
  return Promise.all(texts.map((t) => embed(t)));
}
```

- [ ] **Step 4: Re-run test**

```bash
npm test -- tests/memory/embed.test.ts
```

Expected: PASS (requires `OPENROUTER_API_KEY` in `.env.local`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/memory/embed.ts tests/memory/embed.test.ts
git commit -m "feat(memory): embedding service with versioning"
```

---

## Task 7: Chunker

**Files:**
- Create: `src/lib/memory/chunker.ts`
- Create: `tests/memory/chunker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/memory/chunker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { chunkText } from '@/lib/memory/chunker';

describe('chunkText', () => {
  it('returns one chunk for short content', () => {
    const out = chunkText('Hello world.');
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe('Hello world.');
  });

  it('splits long content with overlap, preserving sentence boundaries', () => {
    const para = 'Sentence one. '.repeat(200);
    const out = chunkText(para, { maxTokens: 200, overlapTokens: 30 });
    expect(out.length).toBeGreaterThan(1);
    // adjacent chunks share at least some tail/head content (overlap)
    for (let i = 1; i < out.length; i++) {
      const prevTail = out[i - 1].content.slice(-100);
      const currHead = out[i].content.slice(0, 100);
      const intersect = [...new Set(prevTail.split(' '))].filter(w => currHead.includes(w));
      expect(intersect.length).toBeGreaterThan(0);
    }
  });

  it('does not split mid-sentence when avoidable', () => {
    const text = 'A. B. C. D. E. F.';
    const out = chunkText(text, { maxTokens: 4, overlapTokens: 1 });
    for (const c of out) {
      expect(c.content.trim().endsWith('.')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test**

```bash
npm test -- tests/memory/chunker.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement chunker**

Create `src/lib/memory/chunker.ts`:

```ts
export interface ChunkOpts {
  maxTokens?: number;       // soft target; uses char/4 heuristic
  overlapTokens?: number;
}

export interface ChunkOutput {
  ord: number;
  content: string;
  approxTokens: number;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9])/g;

const TOKEN_PER_CHAR = 1 / 4;

export function chunkText(text: string, opts: ChunkOpts = {}): ChunkOutput[] {
  const maxTokens = opts.maxTokens ?? 700;
  const overlapTokens = opts.overlapTokens ?? 80;
  const maxChars = Math.floor(maxTokens / TOKEN_PER_CHAR);
  const overlapChars = Math.floor(overlapTokens / TOKEN_PER_CHAR);

  const sentences = text.split(SENTENCE_SPLIT);
  const chunks: ChunkOutput[] = [];
  let buf = '';
  let ord = 0;

  for (const s of sentences) {
    const candidate = buf ? `${buf} ${s}` : s;
    if (candidate.length > maxChars && buf.length > 0) {
      chunks.push({ ord: ord++, content: buf.trim(), approxTokens: Math.ceil(buf.length * TOKEN_PER_CHAR) });
      const tail = buf.slice(-overlapChars);
      buf = (tail + ' ' + s).trim();
    } else {
      buf = candidate;
    }
  }
  if (buf.trim().length > 0) {
    chunks.push({ ord: ord++, content: buf.trim(), approxTokens: Math.ceil(buf.length * TOKEN_PER_CHAR) });
  }
  return chunks;
}
```

- [ ] **Step 4: Re-run test**

```bash
npm test -- tests/memory/chunker.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/memory/chunker.ts tests/memory/chunker.test.ts
git commit -m "feat(memory): chunker with sentence-aware splitting and overlap"
```

---

## Task 8: Ingestion service

**Files:**
- Create: `src/lib/memory/ingest.ts`
- Create: `tests/memory/ingest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/memory/ingest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { ingestSource } from '@/lib/memory/ingest';
import { organizations, users, sources, sourceChunks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('ingestSource', () => {
  it('persists source + chunks with embeddings', async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'Ing', slug: `ing-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `u-${stamp}@e.co`, role: 'member' }).returning();

    const sourceId = await ingestSource({
      orgId: org.id,
      type: 'document',
      ownerUserId: user.id,
      title: 'Test doc',
      chunks: [
        { ord: 0, content: 'Acme uses Stripe.' },
        { ord: 1, content: 'They are migrating to Adyen in Q3.' },
      ],
    });

    const src = await db.select().from(sources).where(eq(sources.id, sourceId));
    expect(src).toHaveLength(1);
    expect(src[0].type).toBe('document');

    const chunks = await db.select().from(sourceChunks).where(eq(sourceChunks.sourceId, sourceId));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].embeddingVersion).toBe(1);
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
npm test -- tests/memory/ingest.test.ts
```

- [ ] **Step 3: Implement ingestSource**

Create `src/lib/memory/ingest.ts`:

```ts
import { db } from '@/lib/db';
import { sources, sourceChunks } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { embedBatch } from './embed';
import type { IngestRequest } from './types';

/**
 * Persist a source and its chunks with embeddings. Returns the source id.
 * If `sourceId` is provided, upserts (used by conversations where the
 * source row mirrors the existing conversation id).
 */
export async function ingestSource(req: IngestRequest): Promise<string> {
  const { orgId, type, ownerUserId, title, meta = {}, chunks, sourceId } = req;

  // 1. Create or upsert the source row
  const [src] = await db
    .insert(sources)
    .values({
      id: sourceId,
      orgId,
      ownerUserId,
      type,
      title: title ?? null,
      meta,
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: { updatedAt: new Date(), title: title ?? sql`${sources.title}` },
    })
    .returning({ id: sources.id });

  if (chunks.length === 0) return src.id;

  // 2. Embed chunks in parallel
  const embeddings = await embedBatch(chunks.map((c) => c.content));

  // 3. Insert chunks
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const e = embeddings[i];
    const [row] = await db
      .insert(sourceChunks)
      .values({
        sourceId: src.id,
        orgId,
        ord: c.ord,
        role: c.role ?? null,
        speakerUserId: c.speakerUserId ?? null,
        content: c.content,
        tokenCount: Math.ceil(c.content.length / 4),
        embeddingVersion: e.version,
        meta: c.meta ?? {},
      })
      .returning({ id: sourceChunks.id });

    await db.execute(
      sql`UPDATE source_chunks SET embedding = ${JSON.stringify(e.vector)}::vector WHERE id = ${row.id}`,
    );
  }

  return src.id;
}
```

- [ ] **Step 4: Re-run test**

```bash
npm test -- tests/memory/ingest.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/memory/ingest.ts tests/memory/ingest.test.ts
git commit -m "feat(memory): ingestSource — persist verbatim chunks with embeddings"
```

---

## Task 9: Hybrid retrieval — semantic leg

**Files:**
- Create: `src/lib/memory/retrieve.ts`
- Create: `tests/memory/retrieve-semantic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/memory/retrieve-semantic.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { ingestSource } from '@/lib/memory/ingest';
import { retrieveSemantic } from '@/lib/memory/retrieve';

describe('retrieveSemantic', () => {
  let orgId: string, userId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'Sem', slug: `sem-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `sem-${stamp}@e.co`, role: 'member' }).returning();
    orgId = org.id; userId = user.id;
    await ingestSource({
      orgId, type: 'document', ownerUserId: userId, title: 'Stripe doc',
      chunks: [
        { ord: 0, content: 'Acme uses Stripe for payment processing and is migrating to Adyen next quarter.' },
        { ord: 1, content: 'Our coffee preference for the office is Blue Bottle.' },
      ],
    });
  });

  it('returns chunks ranked by semantic similarity', async () => {
    const out = await retrieveSemantic({
      query: 'How does Acme handle payments?',
      scope: { userId, teamIds: [], orgId, includeOrg: true },
      limit: 5,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].content).toMatch(/Stripe|Adyen|payment/i);
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
npm test -- tests/memory/retrieve-semantic.test.ts
```

- [ ] **Step 3: Implement retrieveSemantic (skeleton of retrieve.ts)**

Create `src/lib/memory/retrieve.ts`:

```ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { embed } from './embed';
import type { RetrievalCandidate, RetrievalScope } from './types';

interface RetrieveOpts {
  query: string;
  scope: RetrievalScope;
  limit?: number;
  asOf?: Date;
}

function scopeWhere(scope: RetrievalScope) {
  // owner = user OR speaker = user OR (org-shared via the source's owner being an org member when includeOrg)
  // For M1 we use a simple approach: own sources, plus any source whose owner is in the same org if includeOrg.
  return sql`org_id = ${scope.orgId}::uuid`;
}

function asOfWhere(asOf?: Date) {
  if (!asOf) return sql`TRUE`;
  return sql`(valid_at <= ${asOf.toISOString()}::timestamptz AND (invalid_at IS NULL OR invalid_at > ${asOf.toISOString()}::timestamptz))`;
}

export async function retrieveSemantic(opts: RetrieveOpts): Promise<RetrievalCandidate[]> {
  const limit = opts.limit ?? 30;
  const { vector } = await embed(opts.query);

  const rows = await db.execute(sql`
    SELECT id, source_id, content, speaker_user_id, valid_at, meta,
      1 - (embedding <=> ${JSON.stringify(vector)}::vector) AS sim
    FROM source_chunks
    WHERE ${scopeWhere(opts.scope)}
      AND ${asOfWhere(opts.asOf)}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${JSON.stringify(vector)}::vector
    LIMIT ${limit}
  `);

  return (rows.rows as Array<{
    id: string; source_id: string; content: string;
    speaker_user_id: string | null; valid_at: Date;
    meta: Record<string, unknown>; sim: number;
  }>).map((r) => ({
    chunkId: r.id,
    sourceId: r.source_id,
    content: r.content,
    signal: 'semantic' as const,
    rawScore: r.sim,
    speakerUserId: r.speaker_user_id,
    validAt: r.valid_at,
    meta: r.meta,
  }));
}
```

- [ ] **Step 4: Re-run test**

```bash
npm test -- tests/memory/retrieve-semantic.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/memory/retrieve.ts tests/memory/retrieve-semantic.test.ts
git commit -m "feat(memory): semantic retrieval leg via pgvector HNSW"
```

---

## Task 10: Lexical retrieval leg (Postgres FTS)

**Files:**
- Modify: `src/lib/memory/retrieve.ts`
- Create: `tests/memory/retrieve-lexical.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/memory/retrieve-lexical.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { ingestSource } from '@/lib/memory/ingest';
import { retrieveLexical } from '@/lib/memory/retrieve';

describe('retrieveLexical', () => {
  let orgId: string, userId: string;
  beforeAll(async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'Lex', slug: `lex-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `lex-${stamp}@e.co`, role: 'member' }).returning();
    orgId = org.id; userId = user.id;
    await ingestSource({
      orgId, type: 'document', ownerUserId: userId, title: 'SKU notes',
      chunks: [
        { ord: 0, content: 'The SKU-AC-9912 has shipped to BigCo.' },
        { ord: 1, content: 'Random unrelated content about beverages.' },
      ],
    });
  });

  it('finds chunks by exact token match', async () => {
    const out = await retrieveLexical({
      query: 'SKU-AC-9912',
      scope: { userId, teamIds: [], orgId, includeOrg: true },
      limit: 5,
    });
    expect(out[0].content).toContain('SKU-AC-9912');
  });
});
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Add retrieveLexical to `src/lib/memory/retrieve.ts`**

Append:

```ts
export async function retrieveLexical(opts: RetrieveOpts): Promise<RetrievalCandidate[]> {
  const limit = opts.limit ?? 30;
  const rows = await db.execute(sql`
    SELECT id, source_id, content, speaker_user_id, valid_at, meta,
      ts_rank_cd(tsv, plainto_tsquery('english', ${opts.query})) AS rank
    FROM source_chunks
    WHERE ${scopeWhere(opts.scope)}
      AND ${asOfWhere(opts.asOf)}
      AND tsv @@ plainto_tsquery('english', ${opts.query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return (rows.rows as Array<{
    id: string; source_id: string; content: string;
    speaker_user_id: string | null; valid_at: Date;
    meta: Record<string, unknown>; rank: number;
  }>).map((r) => ({
    chunkId: r.id,
    sourceId: r.source_id,
    content: r.content,
    signal: 'lexical' as const,
    rawScore: r.rank,
    speakerUserId: r.speaker_user_id,
    validAt: r.valid_at,
    meta: r.meta,
  }));
}
```

- [ ] **Step 4: Re-run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/memory/retrieve.ts tests/memory/retrieve-lexical.test.ts
git commit -m "feat(memory): lexical retrieval leg via Postgres FTS"
```

---

## Task 11: Entity retrieval leg + entity table seeding

**Files:**
- Modify: `src/lib/memory/retrieve.ts`
- Create: `src/lib/memory/entities.ts`
- Create: `tests/memory/retrieve-entity.test.ts`

- [ ] **Step 1: Implement linkEntity (entity dedup primitive)**

Create `src/lib/memory/entities.ts`:

```ts
import { db } from '@/lib/db';
import { memoryEntities, entityLinks } from '@/lib/db/schema';
import { sql, and, eq } from 'drizzle-orm';
import { embed } from './embed';

const FUZZY_THRESHOLD = 0.4;        // pg_trgm similarity (0..1)
const SEMANTIC_THRESHOLD = 0.85;

export interface EntityRef {
  id: string;
  name: string;
  canonicalName: string;
  type: string;
}

/**
 * Resolve an entity name to its canonical row, creating one if no
 * close match exists. Match logic:
 *  1. Trigram similarity > FUZZY_THRESHOLD on (org, name)
 *  2. Semantic similarity > SEMANTIC_THRESHOLD on embedding
 */
export async function linkEntity(
  orgId: string,
  name: string,
  type: string,
): Promise<EntityRef> {
  const trimmed = name.trim();
  const fuzzy = await db.execute(sql`
    SELECT id, name, canonical_name, type, similarity(name, ${trimmed}) AS sim
    FROM memory_entities
    WHERE org_id = ${orgId}
      AND name % ${trimmed}
    ORDER BY sim DESC
    LIMIT 1
  `);
  if (fuzzy.rows.length > 0) {
    const m = fuzzy.rows[0] as { id: string; name: string; canonical_name: string; type: string; sim: number };
    if (m.sim > FUZZY_THRESHOLD) {
      await db.execute(sql`UPDATE memory_entities SET mention_count = mention_count + 1, last_seen = NOW() WHERE id = ${m.id}`);
      return { id: m.id, name: m.name, canonicalName: m.canonical_name, type: m.type };
    }
  }

  // Embedding fallback
  const { vector } = await embed(trimmed);
  const sem = await db.execute(sql`
    SELECT id, name, canonical_name, type,
      1 - (embedding <=> ${JSON.stringify(vector)}::vector) AS sim
    FROM memory_entities
    WHERE org_id = ${orgId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${JSON.stringify(vector)}::vector
    LIMIT 1
  `);
  if (sem.rows.length > 0) {
    const m = sem.rows[0] as { id: string; name: string; canonical_name: string; type: string; sim: number };
    if (m.sim > SEMANTIC_THRESHOLD) {
      await db.execute(sql`UPDATE memory_entities SET mention_count = mention_count + 1, last_seen = NOW() WHERE id = ${m.id}`);
      return { id: m.id, name: m.name, canonicalName: m.canonical_name, type: m.type };
    }
  }

  // Create new
  const [created] = await db.insert(memoryEntities).values({
    orgId,
    name: trimmed,
    canonicalName: trimmed.toLowerCase(),
    type,
    mentionCount: 1,
  }).returning();
  await db.execute(sql`UPDATE memory_entities SET embedding = ${JSON.stringify(vector)}::vector WHERE id = ${created.id}`);
  return { id: created.id, name: created.name, canonicalName: created.canonicalName, type: created.type };
}

export async function linkEntityToChunk(orgId: string, entityId: string, chunkId: string) {
  await db.insert(entityLinks).values({
    orgId, entityId, chunkId, relationship: 'mentioned_in',
  }).onConflictDoNothing();
}
```

- [ ] **Step 2: Add retrieveByEntity to `retrieve.ts`**

Append:

```ts
import { linkEntity } from './entities';

export async function retrieveByEntity(opts: RetrieveOpts): Promise<RetrievalCandidate[]> {
  const limit = opts.limit ?? 30;
  // Heuristic: pull capitalized noun-ish tokens as entity candidates
  const tokens = (opts.query.match(/\b[A-Z][a-zA-Z0-9._-]{2,}\b/g) ?? []).slice(0, 3);
  if (tokens.length === 0) return [];

  const out: RetrievalCandidate[] = [];
  for (const t of tokens) {
    const fuzzy = await db.execute(sql`
      SELECT e.id
      FROM memory_entities e
      WHERE e.org_id = ${opts.scope.orgId}
        AND e.name % ${t}
      ORDER BY similarity(e.name, ${t}) DESC
      LIMIT 1
    `);
    if (fuzzy.rows.length === 0) continue;
    const entityId = (fuzzy.rows[0] as { id: string }).id;

    const chunks = await db.execute(sql`
      SELECT c.id, c.source_id, c.content, c.speaker_user_id, c.valid_at, c.meta
      FROM source_chunks c
      JOIN entity_links l ON l.chunk_id = c.id AND l.entity_id = ${entityId}
      WHERE c.org_id = ${opts.scope.orgId}
        AND ${asOfWhere(opts.asOf)}
      ORDER BY c.valid_at DESC
      LIMIT ${limit}
    `);
    for (const r of chunks.rows as Array<{ id: string; source_id: string; content: string; speaker_user_id: string | null; valid_at: Date; meta: Record<string, unknown> }>) {
      out.push({
        chunkId: r.id, sourceId: r.source_id, content: r.content,
        signal: 'entity', rawScore: 1.0,
        speakerUserId: r.speaker_user_id, validAt: r.valid_at, meta: r.meta,
      });
    }
  }
  return out;
}
```

- [ ] **Step 3: Write the test**

Create `tests/memory/retrieve-entity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { ingestSource } from '@/lib/memory/ingest';
import { retrieveByEntity } from '@/lib/memory/retrieve';
import { linkEntity, linkEntityToChunk } from '@/lib/memory/entities';
import { sql } from 'drizzle-orm';

describe('retrieveByEntity', () => {
  it('returns chunks linked to a matched entity', async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'E', slug: `e-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `e-${stamp}@e.co`, role: 'member' }).returning();
    const sourceId = await ingestSource({
      orgId: org.id, type: 'document', ownerUserId: user.id, title: 'd',
      chunks: [{ ord: 0, content: 'BigCo agreed to renew.' }],
    });
    const entity = await linkEntity(org.id, 'BigCo', 'customer');
    const chunkRow = await db.execute(sql`SELECT id FROM source_chunks WHERE source_id = ${sourceId}`);
    await linkEntityToChunk(org.id, entity.id, (chunkRow.rows[0] as { id: string }).id);

    const out = await retrieveByEntity({
      query: 'How is BigCo doing?',
      scope: { userId: user.id, teamIds: [], orgId: org.id, includeOrg: true },
      limit: 5,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].content).toContain('BigCo');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/memory/retrieve-entity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/memory/entities.ts src/lib/memory/retrieve.ts tests/memory/retrieve-entity.test.ts
git commit -m "feat(memory): entity dedup + entity-direct retrieval leg"
```

---

## Task 12: Cross-encoder reranker

**Files:**
- Create: `src/lib/memory/rerank.ts`
- Create: `tests/memory/rerank.test.ts`

- [ ] **Step 1: Install Cohere SDK**

```bash
npm install cohere-ai
```

- [ ] **Step 2: Implement reranker**

Create `src/lib/memory/rerank.ts`:

```ts
import { CohereClient } from 'cohere-ai';
import type { RetrievalCandidate, RetrievalResult } from './types';

const cohere = process.env.COHERE_API_KEY
  ? new CohereClient({ token: process.env.COHERE_API_KEY })
  : null;

const RERANK_MODEL = 'rerank-english-v3.0';

interface RerankOpts {
  query: string;
  candidates: RetrievalCandidate[];
  topN?: number;
}

/**
 * Cross-encoder rerank. Falls back to weighted reciprocal-rank fusion
 * (RRF) when no Cohere API key is configured — same shape, lower
 * quality, but the system still works.
 */
export async function rerank({ query, candidates, topN = 8 }: RerankOpts): Promise<RetrievalResult[]> {
  // Dedupe by chunkId, keep the candidate with the strongest signal
  const byId = new Map<string, RetrievalCandidate[]>();
  for (const c of candidates) {
    const arr = byId.get(c.chunkId) ?? [];
    arr.push(c);
    byId.set(c.chunkId, arr);
  }

  const merged = Array.from(byId.entries()).map(([chunkId, sigs]) => ({
    chunkId,
    sigs,
    sample: sigs[0],
  }));

  if (cohere && merged.length > 1) {
    const docs = merged.map((m) => m.sample.content);
    const resp = await cohere.rerank({ model: RERANK_MODEL, query, documents: docs, topN });
    return resp.results.map((r) => {
      const m = merged[r.index];
      return {
        chunkId: m.chunkId,
        sourceId: m.sample.sourceId,
        content: m.sample.content,
        finalScore: r.relevanceScore,
        signals: m.sigs.map((s) => ({ kind: s.signal, score: s.rawScore })),
        speakerUserId: m.sample.speakerUserId,
        validAt: m.sample.validAt,
        meta: m.sample.meta,
      };
    });
  }

  // RRF fallback: score = sum(1 / (60 + rank_in_signal))
  const ranksBySignal: Record<string, Map<string, number>> = {};
  for (const sig of ['semantic', 'lexical', 'entity']) {
    const sorted = candidates
      .filter((c) => c.signal === sig)
      .sort((a, b) => b.rawScore - a.rawScore);
    const ranks = new Map<string, number>();
    sorted.forEach((c, i) => ranks.set(c.chunkId, i + 1));
    ranksBySignal[sig] = ranks;
  }

  const rrf = merged.map((m) => {
    let score = 0;
    for (const sig of ['semantic', 'lexical', 'entity']) {
      const r = ranksBySignal[sig].get(m.chunkId);
      if (r != null) score += 1 / (60 + r);
    }
    return {
      chunkId: m.chunkId,
      sourceId: m.sample.sourceId,
      content: m.sample.content,
      finalScore: score,
      signals: m.sigs.map((s) => ({ kind: s.signal, score: s.rawScore })),
      speakerUserId: m.sample.speakerUserId,
      validAt: m.sample.validAt,
      meta: m.sample.meta,
    };
  });
  rrf.sort((a, b) => b.finalScore - a.finalScore);
  return rrf.slice(0, topN);
}
```

- [ ] **Step 3: Write the test**

Create `tests/memory/rerank.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rerank } from '@/lib/memory/rerank';
import type { RetrievalCandidate } from '@/lib/memory/types';

describe('rerank (RRF fallback)', () => {
  it('fuses three signals into a single ranked list', async () => {
    const candidates: RetrievalCandidate[] = [
      { chunkId: 'A', sourceId: 's', content: 'about Stripe', signal: 'semantic', rawScore: 0.9, speakerUserId: null, validAt: new Date(), meta: {} },
      { chunkId: 'B', sourceId: 's', content: 'about coffee', signal: 'semantic', rawScore: 0.5, speakerUserId: null, validAt: new Date(), meta: {} },
      { chunkId: 'A', sourceId: 's', content: 'about Stripe', signal: 'lexical', rawScore: 0.8, speakerUserId: null, validAt: new Date(), meta: {} },
    ];
    const r = await rerank({ query: 'Stripe', candidates, topN: 2 });
    expect(r[0].chunkId).toBe('A');
    expect(r[0].signals.length).toBe(2);
  });
});
```

- [ ] **Step 4: Run test**

```bash
npm test -- tests/memory/rerank.test.ts
```

(Use the RRF fallback path by ensuring `COHERE_API_KEY` is unset for this test.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/memory/rerank.ts tests/memory/rerank.test.ts package.json package-lock.json
git commit -m "feat(memory): cross-encoder reranker with RRF fallback"
```

---

## Task 13: Unified retrieve() entry point

**Files:**
- Modify: `src/lib/memory/retrieve.ts`
- Create: `tests/memory/retrieve.test.ts`

- [ ] **Step 1: Add the unified `retrieve()` function**

Append to `src/lib/memory/retrieve.ts`:

```ts
import { rerank } from './rerank';
import type { RetrievalResult } from './types';

interface UnifiedRetrieveOpts extends RetrieveOpts {
  topN?: number;
}

/**
 * Unified hybrid retrieval. Runs all three signals in parallel, fuses
 * + reranks, returns the top N final results with provenance.
 */
export async function retrieve(opts: UnifiedRetrieveOpts): Promise<RetrievalResult[]> {
  const [sem, lex, ent] = await Promise.all([
    retrieveSemantic(opts).catch(() => []),
    retrieveLexical(opts).catch(() => []),
    retrieveByEntity(opts).catch(() => []),
  ]);
  return rerank({ query: opts.query, candidates: [...sem, ...lex, ...ent], topN: opts.topN ?? 8 });
}
```

- [ ] **Step 2: Write the integration test**

Create `tests/memory/retrieve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { ingestSource } from '@/lib/memory/ingest';
import { retrieve } from '@/lib/memory/retrieve';

describe('retrieve (unified)', () => {
  it('returns top-N results combining signals', async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'U', slug: `u-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `u-${stamp}@e.co`, role: 'member' }).returning();
    await ingestSource({
      orgId: org.id, type: 'document', ownerUserId: user.id, title: 'mix',
      chunks: [
        { ord: 0, content: 'Acme migrated from Stripe to Adyen in March.' },
        { ord: 1, content: 'Office coffee remains Blue Bottle.' },
        { ord: 2, content: 'SKU-AC-9912 has been discontinued.' },
      ],
    });

    const r = await retrieve({
      query: 'Acme payment processor',
      scope: { userId: user.id, teamIds: [], orgId: org.id, includeOrg: true },
      topN: 3,
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].content).toMatch(/Stripe|Adyen|Acme|payment/i);
    expect(r[0].finalScore).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/memory/retrieve.ts tests/memory/retrieve.test.ts
git commit -m "feat(memory): unified retrieve() — semantic + lexical + entity, reranked"
```

---

## Task 14: Wire chat route to ingest + retrieve

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Replace `searchKnowledgeByVector` with `retrieve`**

In `src/app/api/chat/route.ts`, find the block:

```ts
import { searchKnowledgeByVector } from '@/lib/knowledge/db-store';
```

Replace with:

```ts
import { retrieve } from '@/lib/memory/retrieve';
import { ingestSource } from '@/lib/memory/ingest';
import { users as usersTable } from '@/lib/db/schema';
```

Find the `searchKnowledgeByVector` call inside the POST handler and replace it with:

```ts
let knowledgeContext = clientContext;
if (session?.user?.id && !knowledgeContext) {
  const lastUserMessage = modelMessages.filter(m => m.role === 'user').pop();
  if (lastUserMessage) {
    try {
      const [me] = await db.select({ orgId: usersTable.orgId }).from(usersTable).where(eq(usersTable.id, session.user.id)).limit(1);
      if (me?.orgId) {
        const results = await retrieve({
          query: lastUserMessage.content as string,
          scope: { userId: session.user.id, teamIds: [], orgId: me.orgId, includeOrg: true },
          topN: 8,
        });
        if (results.length > 0) knowledgeContext = results.map(r => r.content);
      }
    } catch {/* best effort */}
  }
}
```

- [ ] **Step 2: After streaming completes, ingest the turn**

In the `onFinish` callback (where `modelUsage` is persisted), add at the end:

```ts
// Ingest the latest user-assistant turn into the verbatim store
try {
  const [me] = await db.select({ orgId: usersTable.orgId }).from(usersTable).where(eq(usersTable.id, session!.user!.id!)).limit(1);
  if (me?.orgId && conversationId && !conversationId.startsWith('pending-')) {
    const lastUser = modelMessages.filter((m) => m.role === 'user').pop();
    const assistantContent = (typeof (result as unknown as { text?: unknown }).text === 'string') ? (result as unknown as { text: string }).text : '';
    if (lastUser && assistantContent) {
      await ingestSource({
        sourceId: conversationId,
        orgId: me.orgId,
        type: 'conversation',
        ownerUserId: session!.user!.id!,
        chunks: [
          { ord: Date.now() - 1, role: 'user', speakerUserId: session!.user!.id!, content: lastUser.content as string },
          { ord: Date.now(),     role: 'assistant', speakerUserId: null,            content: assistantContent },
        ],
      });
    }
  }
} catch (err) { console.error('memory ingest failed:', err); }
```

(Note: the AI SDK v6 `streamText` result exposes the final text via the stream rather than `result.text`. Inspect `result` in the actual `onFinish` argument and pull the assistant text from there. The pattern above is the shape; substitute the real accessor — likely `text` in the `onFinish` argument object alongside `usage`.)

- [ ] **Step 3: Smoke test the chat endpoint**

```bash
npm run dev
```

In the browser, send a message in a conversation, then:

```bash
psql "$DATABASE_URL" -c "SELECT type, title FROM sources ORDER BY created_at DESC LIMIT 3;"
psql "$DATABASE_URL" -c "SELECT ord, role, left(content, 80) FROM source_chunks ORDER BY created_at DESC LIMIT 5;"
```

Expected: a `conversation` source row + two chunks (user + assistant).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(chat): retrieve via hybrid memory + ingest turns into verbatim store"
```

---

## Task 15: Refactor knowledge/extract to enqueue

**Files:**
- Create: `src/lib/memory/queue.ts`
- Modify: `src/app/api/knowledge/extract/route.ts`
- Create: `src/app/api/queue/extract/route.ts`

- [ ] **Step 1: Set up Vercel Queues**

Vercel Queues is enabled per-project in dashboard. Add to `.env.local`:

```
QUEUE_EXTRACT_NAME=osmer-extract
QUEUE_PROJECT_NAME=osmer-project
```

- [ ] **Step 2: Implement queue helpers**

Create `src/lib/memory/queue.ts`:

```ts
// Vercel Queues v1 surface; if SDK exposes it differently in your Next 16,
// adapt the import path. Public API: enqueue + handler decoration.
import { queue } from '@vercel/functions/queue';

const EXTRACT_QUEUE = process.env.QUEUE_EXTRACT_NAME ?? 'osmer-extract';
const PROJECT_QUEUE = process.env.QUEUE_PROJECT_NAME ?? 'osmer-project';

export async function enqueueExtraction(sourceId: string, orgId: string) {
  await queue.send(EXTRACT_QUEUE, { sourceId, orgId });
}

export async function enqueueProjection(orgId: string, scopeUserId: string | null) {
  await queue.send(PROJECT_QUEUE, { orgId, scopeUserId });
}
```

(If `@vercel/functions/queue` is not present in this Next.js 16 release at the time of build, fall back to a thin Postgres-backed work table consumed by a cron job. Pattern documented in `docs/specs/M1-memory-verbatim-store.md` Appendix.)

- [ ] **Step 3: Replace inline extraction with enqueue in the existing route**

`src/app/api/knowledge/extract/route.ts`:

Replace the body of the POST handler:

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueExtraction } from '@/lib/memory/queue';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { conversationId } = await req.json() as { conversationId: string };
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'No org' }, { status: 400 });
  await enqueueExtraction(conversationId, me.orgId);
  return Response.json({ enqueued: true });
}
```

- [ ] **Step 4: Implement the consumer**

Create `src/app/api/queue/extract/route.ts`:

```ts
import { extractEntitiesForSource } from '@/lib/memory/entities';
import { enqueueProjection } from '@/lib/memory/queue';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { sourceId, orgId } = await req.json() as { sourceId: string; orgId: string };
  await extractEntitiesForSource(sourceId, orgId);
  await enqueueProjection(orgId, null);
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Add `extractEntitiesForSource` to entities.ts**

Append to `src/lib/memory/entities.ts`:

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '@/lib/ai/router';
import { sourceChunks } from '@/lib/db/schema';

const NerSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    type: z.enum(['person', 'customer', 'product', 'competitor', 'concept']),
  })),
});

export async function extractEntitiesForSource(sourceId: string, orgId: string) {
  const chunks = await db.select().from(sourceChunks).where(eq(sourceChunks.sourceId, sourceId));
  for (const c of chunks) {
    const { object } = await generateObject({
      model: getLanguageModel(process.env.EXTRACTION_MODEL ?? 'anthropic/claude-haiku-4-5-20251001'),
      schema: NerSchema,
      prompt: `Extract named entities from the following text. Skip generic terms.\n\n${c.content}`,
    });
    for (const e of object.entities) {
      const ent = await linkEntity(orgId, e.name, e.type);
      await linkEntityToChunk(orgId, ent.id, c.id);
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/memory/queue.ts src/app/api/knowledge/extract/route.ts src/app/api/queue/extract/route.ts src/lib/memory/entities.ts
git commit -m "feat(memory): async extraction via Vercel Queues + entity NER consumer"
```

---

## Task 16: Atom projection job

**Files:**
- Create: `src/lib/memory/projection.ts`
- Create: `src/app/api/queue/project/route.ts`

- [ ] **Step 1: Implement projection**

Create `src/lib/memory/projection.ts`:

```ts
import { db } from '@/lib/db';
import { sourceChunks, memoryAtoms } from '@/lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '@/lib/ai/router';
import { embed } from './embed';

const AtomsSchema = z.object({
  atoms: z.array(z.object({
    type: z.enum(['fact', 'decision', 'preference']),
    content: z.string(),
    confidence: z.number().min(0).max(1),
    topics: z.array(z.string()),
  })),
});

const SUPERSEDE_SIM = 0.92;
const NEW_VERSION_SIM = 0.80;

/**
 * Project recent chunks (within `since`) for a scope into atoms.
 * Naive single-cluster pass for M1; M3 introduces HDBSCAN.
 */
export async function projectAtoms(orgId: string, scopeUserId: string | null, sinceHours = 24) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const recent = await db.select().from(sourceChunks)
    .where(and(eq(sourceChunks.orgId, orgId), sql`${sourceChunks.createdAt} >= ${since.toISOString()}`));

  if (recent.length === 0) return { created: 0, affirmed: 0, superseded: 0 };

  const text = recent.map((c) => `[${c.id}] ${c.content}`).join('\n\n');
  const model = getLanguageModel(process.env.PROJECTION_MODEL ?? 'anthropic/claude-sonnet-4-6');
  const { object } = await generateObject({
    model,
    schema: AtomsSchema,
    prompt: `Below are recent conversation/document chunks. Extract reusable atoms (facts, decisions, preferences) that hold across multiple chunks. Each atom should be one clean statement. Skip transient task details. Skip small talk.\n\n${text}`,
  });

  let created = 0, affirmed = 0, superseded = 0;
  for (const a of object.atoms) {
    const { vector } = await embed(a.content);
    const existing = await db.execute(sql`
      SELECT id, content, affirmed_count,
        1 - (embedding <=> ${JSON.stringify(vector)}::vector) AS sim
      FROM memory_atoms
      WHERE org_id = ${orgId}
        AND status = 'active'
        AND embedding IS NOT NULL
        ${scopeUserId ? sql`AND scope_user_id = ${scopeUserId}` : sql``}
      ORDER BY embedding <=> ${JSON.stringify(vector)}::vector
      LIMIT 1
    `);
    const match = existing.rows[0] as { id: string; content: string; affirmed_count: number; sim: number } | undefined;

    if (match && match.sim > SUPERSEDE_SIM) {
      // affirm
      await db.execute(sql`UPDATE memory_atoms SET affirmed_count = affirmed_count + 1, last_affirmed = NOW(), confidence = LEAST(confidence + 0.05, 1.0), updated_at = NOW() WHERE id = ${match.id}`);
      affirmed++;
      continue;
    }

    if (match && match.sim > NEW_VERSION_SIM) {
      await db.execute(sql`UPDATE memory_atoms SET status = 'superseded', invalid_at = NOW(), updated_at = NOW() WHERE id = ${match.id}`);
      superseded++;
    }

    const [row] = await db.insert(memoryAtoms).values({
      orgId,
      scopeUserId: scopeUserId ?? null,
      type: a.type,
      content: a.content,
      confidence: a.confidence,
      topics: a.topics,
      supersedesId: match && match.sim > NEW_VERSION_SIM ? match.id : null,
      sourceIds: recent.map((c) => c.id),
    }).returning({ id: memoryAtoms.id });
    await db.execute(sql`UPDATE memory_atoms SET embedding = ${JSON.stringify(vector)}::vector WHERE id = ${row.id}`);
    created++;
  }

  return { created, affirmed, superseded };
}
```

- [ ] **Step 2: Implement the queue consumer**

Create `src/app/api/queue/project/route.ts`:

```ts
import { projectAtoms } from '@/lib/memory/projection';

export const maxDuration = 120;

export async function POST(req: Request) {
  const { orgId, scopeUserId } = await req.json() as { orgId: string; scopeUserId: string | null };
  const out = await projectAtoms(orgId, scopeUserId);
  return Response.json({ ok: true, ...out });
}
```

- [ ] **Step 3: Smoke test**

After ingesting a conversation, manually fire:

```bash
curl -X POST localhost:3000/api/queue/project -H 'content-type: application/json' \
  -d '{"orgId":"<uuid>","scopeUserId":"<uuid>"}'
```

Expected: 200 with `{created, affirmed, superseded}` counts.

- [ ] **Step 4: Commit**

```bash
git add src/lib/memory/projection.ts src/app/api/queue/project/route.ts
git commit -m "feat(memory): atom projection job (cluster-pass)"
```

---

## Task 17: Cron jobs — affirmation, drift, disagreement, consolidation, health

**Files:**
- Create: `vercel.ts`
- Create: `src/lib/memory/cron/affirmation.ts`
- Create: `src/lib/memory/cron/drift.ts`
- Create: `src/lib/memory/cron/disagreement.ts`
- Create: `src/lib/memory/cron/consolidation.ts`
- Create: `src/lib/memory/cron/health.ts`
- Create: `src/app/api/cron/[job]/route.ts`

- [ ] **Step 1: Install `@vercel/config`**

```bash
npm install @vercel/config
```

- [ ] **Step 2: Write `vercel.ts`**

Create `vercel.ts` at the repo root:

```ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    { path: '/api/cron/affirmation',  schedule: '0 6 * * *' },         // daily 06:00 UTC
    { path: '/api/cron/drift',        schedule: '15 6 * * *' },        // daily 06:15
    { path: '/api/cron/disagreement', schedule: '0 7 * * 1' },         // Mondays 07:00
    { path: '/api/cron/consolidation', schedule: '30 7 * * 1' },       // Mondays 07:30
    { path: '/api/cron/health',       schedule: '0 8 * * 1' },         // Mondays 08:00
  ],
};

export default config;
```

- [ ] **Step 3: Implement `affirmation.ts`**

Create `src/lib/memory/cron/affirmation.ts`:

```ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Increment affirmed_count + last_affirmed for atoms whose source
 * chunks were retrieved successfully in the last 24h. Retrieval
 * success is approximated by atoms whose source chunks appear in
 * recent retrieval logs; for M1 we use a simpler signal: any atom
 * whose source chunks were updated in the past 24h.
 */
export async function runAffirmation() {
  const result = await db.execute(sql`
    UPDATE memory_atoms a
    SET affirmed_count = affirmed_count + 1,
        last_affirmed = NOW(),
        confidence = LEAST(confidence + 0.02, 1.0),
        updated_at = NOW()
    WHERE a.status = 'active'
      AND EXISTS (
        SELECT 1 FROM source_chunks c
        WHERE c.id::text = ANY (SELECT jsonb_array_elements_text(a.source_ids))
          AND c.created_at >= NOW() - INTERVAL '24 hours'
      )
    RETURNING a.id
  `);
  return { affirmed: result.rows.length };
}
```

- [ ] **Step 4: Implement `drift.ts`**

Create `src/lib/memory/cron/drift.ts`:

```ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

const DECAY_RATE_BY_TYPE: Record<string, number> = {
  fact: 0.4, decision: 0.2, preference: 0.3,
};

export async function runDrift() {
  const decayed = await db.execute(sql`
    UPDATE memory_atoms
    SET confidence = confidence * EXP(
          - CASE type
              WHEN 'fact' THEN ${DECAY_RATE_BY_TYPE.fact}
              WHEN 'decision' THEN ${DECAY_RATE_BY_TYPE.decision}
              ELSE ${DECAY_RATE_BY_TYPE.preference}
            END
          * EXTRACT(EPOCH FROM (NOW() - last_affirmed)) / (365.0 * 86400)
        ),
        updated_at = NOW()
    WHERE status = 'active'
      AND last_affirmed < NOW() - INTERVAL '7 days'
    RETURNING id
  `);
  const stale = await db.execute(sql`
    UPDATE memory_atoms SET status = 'stale', updated_at = NOW()
    WHERE status = 'active' AND confidence < 0.3
    RETURNING id
  `);
  return { decayed: decayed.rows.length, stale: stale.rows.length };
}
```

- [ ] **Step 5: Implement `disagreement.ts`**

Create `src/lib/memory/cron/disagreement.ts`:

```ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

const SIM_THRESHOLD = 0.85;

/**
 * Find pairs of active atoms with high similarity but different
 * content (proxy for contradiction). The newer one supersedes the
 * older; the older is archived.
 */
export async function runDisagreement() {
  const pairs = await db.execute(sql`
    SELECT a.id AS new_id, b.id AS old_id
    FROM memory_atoms a
    JOIN memory_atoms b
      ON a.org_id = b.org_id
      AND a.type = b.type
      AND a.status = 'active' AND b.status = 'active'
      AND a.created_at > b.created_at
      AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
      AND 1 - (a.embedding <=> b.embedding) > ${SIM_THRESHOLD}
      AND a.content <> b.content
    LIMIT 100
  `);
  let archived = 0;
  for (const r of pairs.rows as Array<{ new_id: string; old_id: string }>) {
    await db.execute(sql`UPDATE memory_atoms SET status = 'superseded', invalid_at = NOW(), updated_at = NOW() WHERE id = ${r.old_id}`);
    await db.execute(sql`UPDATE memory_atoms SET supersedes_id = ${r.old_id} WHERE id = ${r.new_id}`);
    archived++;
  }
  return { archived };
}
```

- [ ] **Step 6: Implement `consolidation.ts`**

Create `src/lib/memory/cron/consolidation.ts`:

```ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Merge near-duplicate active atoms (>=0.95 similarity, same content
 * trim equality). Keeper is the one with the highest affirmed_count.
 */
export async function runConsolidation() {
  const candidates = await db.execute(sql`
    SELECT a.id AS keep_id, b.id AS drop_id
    FROM memory_atoms a
    JOIN memory_atoms b
      ON a.id < b.id
      AND a.org_id = b.org_id
      AND a.type = b.type
      AND a.status = 'active' AND b.status = 'active'
      AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
      AND 1 - (a.embedding <=> b.embedding) > 0.95
      AND a.affirmed_count >= b.affirmed_count
    LIMIT 100
  `);
  let merged = 0;
  for (const r of candidates.rows as Array<{ keep_id: string; drop_id: string }>) {
    await db.execute(sql`
      UPDATE memory_atoms SET
        affirmed_count = (SELECT affirmed_count FROM memory_atoms WHERE id = ${r.keep_id}) +
                         (SELECT affirmed_count FROM memory_atoms WHERE id = ${r.drop_id}),
        source_ids = (SELECT source_ids FROM memory_atoms WHERE id = ${r.keep_id}) ||
                     (SELECT source_ids FROM memory_atoms WHERE id = ${r.drop_id}),
        updated_at = NOW()
      WHERE id = ${r.keep_id}
    `);
    await db.execute(sql`UPDATE memory_atoms SET status = 'superseded', supersedes_id = ${r.keep_id}, invalid_at = NOW() WHERE id = ${r.drop_id}`);
    merged++;
  }
  return { merged };
}
```

- [ ] **Step 7: Implement `health.ts`**

Create `src/lib/memory/cron/health.ts`:

```ts
import { db } from '@/lib/db';
import { memorySnapshots } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Compute a per-org weekly health snapshot and persist a thin row.
 * The Memory Map (M5) replaces this with full graph snapshots; for
 * M1 we just record metrics.
 */
export async function runHealth() {
  const orgs = await db.execute(sql`SELECT id FROM organizations`);
  let written = 0;
  for (const o of orgs.rows as Array<{ id: string }>) {
    const stats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM source_chunks WHERE org_id = ${o.id}) AS chunks,
        (SELECT COUNT(*) FROM memory_atoms  WHERE org_id = ${o.id} AND status = 'active') AS active_atoms,
        (SELECT COUNT(*) FROM memory_atoms  WHERE org_id = ${o.id} AND status = 'stale')  AS stale_atoms,
        (SELECT COUNT(DISTINCT scope_user_id) FROM memory_atoms WHERE org_id = ${o.id}) AS contributors
    `);
    const row = stats.rows[0] as Record<string, number | string>;
    await db.insert(memorySnapshots).values({
      orgId: o.id,
      nodes: { metrics: row },
      edges: {},
      contributorWeights: {},
      topicClusters: {},
    });
    written++;
  }
  return { snapshots: written };
}
```

- [ ] **Step 8: Cron entry route**

Create `src/app/api/cron/[job]/route.ts`:

```ts
import { runAffirmation } from '@/lib/memory/cron/affirmation';
import { runDrift } from '@/lib/memory/cron/drift';
import { runDisagreement } from '@/lib/memory/cron/disagreement';
import { runConsolidation } from '@/lib/memory/cron/consolidation';
import { runHealth } from '@/lib/memory/cron/health';

export const maxDuration = 300;

const HANDLERS: Record<string, () => Promise<unknown>> = {
  affirmation: runAffirmation,
  drift: runDrift,
  disagreement: runDisagreement,
  consolidation: runConsolidation,
  health: runHealth,
};

function isAuthorized(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ job: string }> }) {
  if (!isAuthorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { job } = await ctx.params;
  const handler = HANDLERS[job];
  if (!handler) return Response.json({ error: 'unknown job' }, { status: 404 });
  const out = await handler();
  return Response.json({ job, out });
}
```

- [ ] **Step 9: Add `CRON_SECRET` to `.env.example`**

Edit `.env.example` to include:

```
CRON_SECRET=
```

- [ ] **Step 10: Smoke test**

```bash
export CRON_SECRET=test
curl -H "authorization: Bearer test" http://localhost:3000/api/cron/affirmation
curl -H "authorization: Bearer test" http://localhost:3000/api/cron/drift
curl -H "authorization: Bearer test" http://localhost:3000/api/cron/health
```

Expected: 200 with results.

- [ ] **Step 11: Commit**

```bash
git add vercel.ts src/lib/memory/cron/ src/app/api/cron/ .env.example package.json package-lock.json
git commit -m "feat(memory): vercel.ts cron + 5 evolution jobs (affirmation, drift, disagreement, consolidation, health)"
```

---

## Task 18: Migrate legacy knowledge_atoms data

**Files:**
- Create: `scripts/migrate-knowledge-to-memory.ts`

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-knowledge-to-memory.ts`:

```ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { sources, sourceChunks, memoryAtoms } from '../src/lib/db/schema';
import { embed } from '../src/lib/memory/embed';

async function main() {
  // 1. Each existing knowledge atom becomes a memory_atom.
  //    Its content also lands as a manual `source` of type 'document'
  //    so retrieval over verbatim content still works.
  const legacy = await db.execute(sql`
    SELECT id, org_id, scope_id, type, content, confidence,
           topics, structured, source_conversation_id, source_user_id,
           created_at, last_affirmed, affirmed_count
    FROM knowledge_atoms
    WHERE status = 'active'
  `);

  let migrated = 0;
  for (const row of legacy.rows as Array<Record<string, unknown>>) {
    const orgId = row.org_id as string | null;
    if (!orgId) continue;

    // Create a synthetic source for traceability
    const [src] = await db.insert(sources).values({
      orgId,
      ownerUserId: row.source_user_id as string | null,
      type: 'document',
      title: 'Migrated atom',
      meta: { legacyAtomId: row.id, structured: row.structured },
    }).returning({ id: sources.id });

    // One chunk per atom (the content)
    const { vector } = await embed(row.content as string);
    const [chunk] = await db.insert(sourceChunks).values({
      sourceId: src.id,
      orgId,
      ord: 0,
      role: null,
      speakerUserId: row.source_user_id as string | null,
      content: row.content as string,
      tokenCount: Math.ceil((row.content as string).length / 4),
      embeddingVersion: 1,
    }).returning({ id: sourceChunks.id });
    await db.execute(sql`UPDATE source_chunks SET embedding = ${JSON.stringify(vector)}::vector WHERE id = ${chunk.id}`);

    // Atom in new table
    const t = row.type as string;
    const collapsedType = t === 'fact' ? 'fact' : t === 'decision' ? 'decision' : t === 'preference' ? 'preference' :
                          t === 'solution' ? 'fact' : t === 'process' ? 'fact' : t === 'relationship' ? 'fact' : 'fact';
    const [atom] = await db.insert(memoryAtoms).values({
      orgId,
      scopeUserId: row.scope_id as string,
      type: collapsedType as 'fact' | 'decision' | 'preference',
      content: row.content as string,
      confidence: row.confidence as number,
      affirmedCount: row.affirmed_count as number,
      lastAffirmed: row.last_affirmed as Date,
      status: 'active',
      sourceIds: [chunk.id],
      topics: (row.topics as string[]) ?? [],
    }).returning({ id: memoryAtoms.id });
    await db.execute(sql`UPDATE memory_atoms SET embedding = ${JSON.stringify(vector)}::vector WHERE id = ${atom.id}`);
    migrated++;
  }

  console.log(`migrated ${migrated} legacy atoms`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the migration on the dev DB**

```bash
npx tsx scripts/migrate-knowledge-to-memory.ts
```

Expected: log line `migrated N legacy atoms`. Verify:

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM memory_atoms;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM source_chunks;"
```

Should be ≥ legacy count.

- [ ] **Step 3: Add tsx if missing**

If `tsx` is not installed:

```bash
npm install -D tsx
```

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-knowledge-to-memory.ts package.json package-lock.json
git commit -m "chore(migration): port knowledge_atoms to memory_atoms + sources/chunks"
```

---

## Task 19: Update knowledge/ask to use new retrieve()

**Files:**
- Modify: `src/app/api/knowledge/ask/route.ts`

- [ ] **Step 1: Replace the search call**

In `src/app/api/knowledge/ask/route.ts`, change:

```ts
import { searchKnowledgeByVector } from '@/lib/knowledge/db-store';
```

to:

```ts
import { retrieve } from '@/lib/memory/retrieve';
import { users } from '@/lib/db/schema';
```

Replace the `searchKnowledgeByVector` block:

```ts
const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
if (!me?.orgId) return Response.json({ error: "No org" }, { status: 400 });

const results = await retrieve({
  query: question,
  scope: { userId: session.user.id, teamIds, orgId: me.orgId, includeOrg: true },
  topN: 15,
});

if (results.length === 0) {
  return Response.json({ answer: "Nothing in the knowledge base touches on that yet. Discuss it in a chat to seed it.", sources: [] });
}

const knowledgeBlock = results
  .map((r, i) => `[${i + 1}] (score: ${r.finalScore.toFixed(3)}): ${r.content}`)
  .join('\n');
```

And update the return value `sources` array:

```ts
sources: results.map((r, i) => ({
  n: i + 1,
  chunkId: r.chunkId,
  sourceId: r.sourceId,
  content: r.content,
  score: r.finalScore,
})),
```

- [ ] **Step 2: Smoke test**

```bash
curl -X POST localhost:3000/api/knowledge/ask -H 'content-type: application/json' \
  -d '{"question":"What is our payment processor?","modelId":"anthropic/claude-sonnet-4-6"}' \
  --cookie "<your auth cookie>"
```

Expected: 200 with `answer` and `sources`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/knowledge/ask/route.ts
git commit -m "feat(ask): grounded answers via hybrid retrieve()"
```

---

## Task 20: LongMemEval data loader

**Files:**
- Create: `evals/longmemeval/data.ts`
- Create: `evals/longmemeval/types.ts`

- [ ] **Step 1: Write types**

Create `evals/longmemeval/types.ts`:

```ts
export interface LMETask {
  id: string;
  question_type: 'single-session-user' | 'single-session-assistant' | 'temporal-reasoning' | 'multi-session' | 'knowledge-update' | 'abstention';
  question: string;
  answer: string | null;          // null => abstention
  haystack_sessions: Array<Array<{ role: 'user' | 'assistant'; content: string }>>;
  answer_session_ids: string[];
}
```

- [ ] **Step 2: Implement data loader**

Create `evals/longmemeval/data.ts`:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { LMETask } from './types';

const CACHE = path.resolve(process.cwd(), '.cache/longmemeval-s.json');
const URL = 'https://huggingface.co/datasets/xiaowuc2/longmemeval/resolve/main/longmemeval_s.json';

export async function loadLongMemEvalSubset(limit = 200): Promise<LMETask[]> {
  await fs.mkdir(path.dirname(CACHE), { recursive: true });
  let raw: string;
  try {
    raw = await fs.readFile(CACHE, 'utf8');
  } catch {
    const r = await fetch(URL);
    if (!r.ok) throw new Error(`failed to fetch LongMemEval: ${r.status}`);
    raw = await r.text();
    await fs.writeFile(CACHE, raw);
  }
  const all = JSON.parse(raw) as LMETask[];
  return all.slice(0, limit);
}
```

- [ ] **Step 3: Smoke**

```bash
npx tsx -e "import('./evals/longmemeval/data').then(m => m.loadLongMemEvalSubset(5).then(t => console.log(t.length, t[0].question_type)))"
```

Expected: prints `5` and a question type.

- [ ] **Step 4: Commit**

```bash
git add evals/longmemeval/data.ts evals/longmemeval/types.ts
git commit -m "feat(eval): LongMemEval subset loader (cached)"
```

---

## Task 21: LongMemEval runner — recall@5

**Files:**
- Create: `evals/longmemeval/run.ts`
- Modify: `package.json` (script)

- [ ] **Step 1: Implement the runner**

Create `evals/longmemeval/run.ts`:

```ts
import { loadLongMemEvalSubset } from './data';
import { db } from '../../src/lib/db';
import { organizations, users } from '../../src/lib/db/schema';
import { ingestSource } from '../../src/lib/memory/ingest';
import { retrieve } from '../../src/lib/memory/retrieve';

interface RunResult {
  total: number;
  recallAt5: number;
  byType: Record<string, { total: number; hits: number }>;
}

async function main() {
  const tasks = await loadLongMemEvalSubset(Number(process.env.LME_LIMIT ?? 50));
  const results: RunResult = { total: 0, recallAt5: 0, byType: {} };

  // Per-task: fresh org+user. Ingest haystack sessions as conversations.
  for (const task of tasks) {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [org]  = await db.insert(organizations).values({ name: 'lme', slug: `lme-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'Tester', email: `lme-${stamp}@e.co`, role: 'member' }).returning();

    // Ingest each session as a conversation source
    const answerChunkIds = new Set<string>();
    for (let s = 0; s < task.haystack_sessions.length; s++) {
      const session = task.haystack_sessions[s];
      const sourceId = await ingestSource({
        orgId: org.id, type: 'conversation', ownerUserId: user.id, title: `session-${s}`,
        chunks: session.map((m, i) => ({ ord: i, role: m.role, content: m.content, speakerUserId: m.role === 'user' ? user.id : null })),
      });
      if (task.answer_session_ids.includes(String(s))) {
        // mark chunks of this session as the gold set
        // (we look them up later by sourceId)
        answerChunkIds.add(sourceId);
      }
    }

    // Retrieve top-5 for the question
    const r = await retrieve({
      query: task.question,
      scope: { userId: user.id, teamIds: [], orgId: org.id, includeOrg: true },
      topN: 5,
    });

    const hit = r.some((x) => answerChunkIds.has(x.sourceId));
    const bucket = (results.byType[task.question_type] ??= { total: 0, hits: 0 });
    bucket.total++;
    results.total++;
    if (hit) { results.recallAt5++; bucket.hits++; }
  }

  results.recallAt5 = results.recallAt5 / results.total;
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add npm script**

In `package.json`, add to `"scripts"`:

```json
"eval:longmemeval": "tsx evals/longmemeval/run.ts"
```

- [ ] **Step 3: Run**

```bash
LME_LIMIT=20 npm run eval:longmemeval
```

Expected: a JSON dump with `recallAt5` and per-type buckets. Goal is ≥ 0.75 on the 200-task run (`LME_LIMIT=200`). For M1 acceptance, run the full 200 once at the end.

- [ ] **Step 4: Commit**

```bash
git add evals/longmemeval/run.ts package.json
git commit -m "feat(eval): LongMemEval recall@5 runner"
```

---

## Task 22: Tenant-isolation cross-org leak test

**Files:**
- Create: `tests/db/rls-leak.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/db/rls-leak.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { ingestSource } from '@/lib/memory/ingest';
import { retrieve } from '@/lib/memory/retrieve';
import { withTenant } from '@/lib/db/tenant';
import { sql } from 'drizzle-orm';

describe('cross-tenant isolation', () => {
  it('does not leak chunks across orgs', async () => {
    const stamp = Date.now();
    const [orgA] = await db.insert(organizations).values({ name: 'A', slug: `rls-a-${stamp}` }).returning();
    const [orgB] = await db.insert(organizations).values({ name: 'B', slug: `rls-b-${stamp}` }).returning();
    const [userA] = await db.insert(users).values({ orgId: orgA.id, name: 'A', email: `rls-a-${stamp}@e.co`, role: 'member' }).returning();
    const [userB] = await db.insert(users).values({ orgId: orgB.id, name: 'B', email: `rls-b-${stamp}@e.co`, role: 'member' }).returning();

    await ingestSource({ orgId: orgA.id, type: 'document', ownerUserId: userA.id, title: 'A', chunks: [{ ord: 0, content: 'Org A secret: Acme uses Stripe' }] });
    await ingestSource({ orgId: orgB.id, type: 'document', ownerUserId: userB.id, title: 'B', chunks: [{ ord: 0, content: 'Org B secret: Acme uses Stripe' }] });

    // From within orgA's tenant context, only A's chunks are visible
    const visible = await withTenant(orgA.id, async (tx) => {
      return tx.execute(sql`SELECT content FROM source_chunks`);
    });
    const contents = (visible.rows as Array<{ content: string }>).map(r => r.content);
    expect(contents).toContain('Org A secret: Acme uses Stripe');
    expect(contents).not.toContain('Org B secret: Acme uses Stripe');
  });
});
```

- [ ] **Step 2: Run**

```bash
npm test -- tests/db/rls-leak.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/db/rls-leak.test.ts
git commit -m "test(db): RLS prevents cross-tenant chunk visibility"
```

---

## Task 23: Cutover checklist + cleanup

**Files:**
- Modify: `src/lib/knowledge/db-store.ts`
- Delete: `src/lib/knowledge/embeddings.ts`

- [ ] **Step 1: Mark legacy `searchKnowledgeByVector` as deprecated**

In `src/lib/knowledge/db-store.ts`, prepend the function with:

```ts
/** @deprecated Use src/lib/memory/retrieve.ts. Removed in M3. */
```

- [ ] **Step 2: Replace `src/lib/knowledge/embeddings.ts` re-exports**

Replace its contents with:

```ts
export { embed as generateEmbeddingV2 } from '@/lib/memory/embed';
/** @deprecated Use src/lib/memory/embed.ts. */
import { embed } from '@/lib/memory/embed';
export async function generateEmbedding(text: string): Promise<number[]> {
  return (await embed(text)).vector;
}
```

This keeps any remaining callers working while we migrate them.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 4: Run the eval at full size**

```bash
LME_LIMIT=200 npm run eval:longmemeval
```

Expected: `recallAt5 >= 0.75`. If lower, investigate the byType breakdown — knowledge-update and temporal-reasoning are the typical weak spots. File follow-up tasks; do not block M1 unless < 0.65.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/db-store.ts src/lib/knowledge/embeddings.ts
git commit -m "chore(memory): deprecate legacy knowledge module; backwards-compat shims"
```

---

## Task 24: Document the milestone outcome

**Files:**
- Create: `docs/specs/M1-results.md`

- [ ] **Step 1: Capture metrics**

Create `docs/specs/M1-results.md`:

```markdown
# M1 — Results

**Run date:** YYYY-MM-DD
**Eval results:** (paste JSON output of `LME_LIMIT=200 npm run eval:longmemeval`)

## Acceptance gates

- [ ] Hybrid retrieval recall@5 ≥ 0.75 on LongMemEval-S 200 subset
- [ ] Cross-tenant RLS test passing
- [ ] All cron jobs running on schedule (verify via Vercel dashboard after deploy)
- [ ] Chat ingestion writes to source_chunks for every turn
- [ ] knowledge/ask returns answers grounded in retrieved chunks

## Follow-ups (push to M3)

- HDBSCAN-based clustering in `projection.ts` (currently single-pass)
- Custom cross-user eval set (M3)
- Reranker cost benchmark (Cohere vs Voyage)
- Drop legacy `knowledge_atoms` table (after 1-week soak)
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/M1-results.md
git commit -m "docs(m1): results template"
```

---

## Self-review notes

**Spec coverage check:**
- Verbatim store with sources/source_chunks: T2 ✓
- Hybrid retrieval (semantic + lexical + entity): T9, T10, T11, T13 ✓
- Cross-encoder reranker: T12 ✓
- Embedding versioning: T2 (column) + T6 (service) ✓
- Bi-temporal valid_at/invalid_at: T2 (columns) + retrieve asOfWhere helper (T9) ✓
- Postgres RLS: T3 ✓
- Tenant context: T4 ✓
- Vercel Queues async extraction: T15 ✓
- Daily/weekly cron: T17 ✓
- Atom projection: T16 ✓
- Entity NER + dedup: T11 ✓
- Migration of legacy data: T18 ✓
- LongMemEval recall@5 ≥ 0.75 acceptance: T21 + T23 ✓
- Cross-tenant isolation acceptance: T22 ✓
- Chat ingestion + retrieval cutover: T14 ✓

**Out of M1, deferred to M3:** custom cross-user eval set; abstention precision metric; output-quality rubric for AI Employees; safety probe set; HDBSCAN clustering; explicit Sentry/OTel instrumentation (Vercel AI Gateway covers model-call observability).

**Out of M1 entirely:** PII detection (M2), cost ceilings (M2), Memory Map (M5), MCP server (M4), per-employee scope (M4).

---

## Execution choice

**Plan complete and saved to `docs/specs/M1-memory-verbatim-store.md`.**

Two execution options:

1. **Subagent-driven (recommended)** — I dispatch a fresh subagent per task, you review between tasks, fast iteration.
2. **Inline execution** — execute tasks in this session, batched with checkpoints.

Which approach?
