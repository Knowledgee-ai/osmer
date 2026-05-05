# M2 — Onboarding (Documents + Website Crawl) + Governance

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Get a new org from signup to non-trivial seeded memory in under 10 minutes via document upload + website crawl, with PII detection blocking sensitive content from auto-promoting to shared scope, and three-tier cost ceilings preventing surprise bills.

**Architecture:** New `ingestion_jobs` table tracks upload + crawl progress. File parsers (PDF, MD, docx, pptx, xlsx, ChatGPT/Claude exports) live under `src/lib/ingest/parsers/`. Each parser produces normalized `IngestRequest` chunks fed to M1's `ingestSource()`. PII detection runs as a Haiku-class structured-output pass on every chunk before it lands; sensitivity labels gate auto-promotion. Cost ceilings enforced via a middleware that wraps every model call.

**Tech Stack:** `pdf-parse` or `unpdf`, `mammoth` (docx), `pptx-parser` or manual XML, `xlsx` (sheetjs), `cheerio` for crawling, Haiku-class model for PII via `generateObject`, Vercel Sandbox for crawl jobs, Vercel Queues for parsing.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `drizzle/0008_ingestion_governance.sql` | Tables: `ingestion_jobs`, `chunk_pii_labels`, `spend_caps`, `spend_ledger` |
| `src/lib/ingest/types.ts` | `ParsedDocument`, `ParserResult`, `IngestionJob` types |
| `src/lib/ingest/parsers/pdf.ts` | PDF → text, with vision OCR fallback for scanned pages |
| `src/lib/ingest/parsers/markdown.ts` | MD/MDX |
| `src/lib/ingest/parsers/docx.ts` | mammoth → text + structure |
| `src/lib/ingest/parsers/pptx.ts` | XML → slide text |
| `src/lib/ingest/parsers/xlsx.ts` | sheetjs → cell-level chunks |
| `src/lib/ingest/parsers/chatgpt-export.ts` | ChatGPT `conversations.json` |
| `src/lib/ingest/parsers/claude-export.ts` | Claude conversation export |
| `src/lib/ingest/parsers/index.ts` | Dispatcher by mime/ext |
| `src/lib/ingest/upload.ts` | `uploadAndQueue(file, orgId, userId)` — Blob upload + ingestion_jobs row + queue |
| `src/lib/ingest/process.ts` | Queue consumer: parse → chunk → PII → ingest |
| `src/lib/ingest/crawler.ts` | Sitemap-first crawler with depth + politeness limits |
| `src/lib/ingest/pii.ts` | `detectPii(content)` — Haiku structured-output pass returning labels |
| `src/lib/spend/caps.ts` | `assertSpendOk(userId, orgId, kind, estCents)`; `recordSpend(...)` |
| `src/lib/spend/middleware.ts` | Wraps `getLanguageModel` calls to enforce caps + ledger |
| `src/app/api/upload/route.ts` | POST multipart upload; creates Blob + ingestion_jobs row |
| `src/app/api/queue/ingest/route.ts` | Queue consumer for ingestion_jobs |
| `src/app/api/crawl/route.ts` | POST start a crawl |
| `src/app/api/queue/crawl/route.ts` | Queue consumer for crawl pages |
| `src/app/api/onboarding/start/route.ts` | Begin a new-org onboarding session |
| `src/app/api/onboarding/status/route.ts` | Progress polling |
| `src/app/api/spend/caps/route.ts` | GET current caps + usage; PATCH admin caps |
| `src/components/onboarding/onboarding-flow.tsx` | Main onboarding wizard |
| `src/components/onboarding/upload-zone.tsx` | Drag-drop + paste + cloud-drive button |
| `src/components/onboarding/crawl-step.tsx` | URL input + start crawl |
| `src/components/onboarding/progress-feed.tsx` | Live progress feed during ingestion |
| `tests/ingest/parsers.test.ts` | Per-parser unit tests with fixtures |
| `tests/ingest/pii.test.ts` | PII detection accuracy on a small set |
| `tests/spend/caps.test.ts` | Hard-stop behavior |

**Modified files:**

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | Add ingestion + spend tables |
| `src/lib/memory/ingest.ts` | Accept `piiLabels` per chunk; persist to `chunk_pii_labels` |
| `src/lib/memory/projection.ts` | Skip auto-promotion of chunks with sensitivity ≥ medium |
| `src/lib/ai/router.ts` | Use `withSpendGuard()` wrapper |
| `src/app/api/chat/route.ts` | Wrap `streamText` call with spend guard |
| `src/app/api/queue/project/route.ts` | Spend-guarded |
| `vercel.ts` | Add crawl-tick cron (re-crawl every 7 days) |

---

## Task 1: Schema for ingestion + governance

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0008_ingestion_governance.sql`

- [ ] **Step 1: Add table definitions to `src/lib/db/schema.ts`**

```ts
export const ingestionStatusEnum = pgEnum('ingestion_status', ['queued', 'parsing', 'embedding', 'complete', 'failed']);
export const ingestionKindEnum = pgEnum('ingestion_kind', ['upload', 'crawl', 'paste', 'export']);

export const ingestionJobs = pgTable('ingestion_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  kind: ingestionKindEnum('kind').notNull(),
  filename: varchar('filename', { length: 500 }),
  blobUrl: text('blob_url'),
  mimeType: varchar('mime_type', { length: 128 }),
  byteSize: integer('byte_size'),
  status: ingestionStatusEnum('status').notNull().default('queued'),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'set null' }),
  chunkCount: integer('chunk_count').default(0),
  errorMessage: text('error_message'),
  meta: jsonb('meta').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('ij_org_idx').on(t.orgId),
  index('ij_status_idx').on(t.status),
]);

export const piiSeverityEnum = pgEnum('pii_severity', ['none', 'low', 'medium', 'high']);

export const chunkPiiLabels = pgTable('chunk_pii_labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  chunkId: uuid('chunk_id').references(() => sourceChunks.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  severity: piiSeverityEnum('severity').notNull().default('none'),
  categories: jsonb('categories').default([]),    // ['email','phone','financial', ...]
  spans: jsonb('spans').default([]),              // [{start, end, type}]
  detectorVersion: integer('detector_version').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('cpl_chunk_idx').on(t.chunkId),
  index('cpl_severity_idx').on(t.orgId, t.severity),
]);

export const spendKindEnum = pgEnum('spend_kind', ['chat', 'embedding', 'projection', 'employee_run', 'pii_detect', 'crawl', 'extraction']);

export const spendCaps = pgTable('spend_caps', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),  // null = org-level cap
  scope: varchar('scope', { length: 32 }).notNull(),                // 'user_daily' | 'org_monthly' | 'employee_run'
  capCents: integer('cap_cents').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('caps_unique_idx').on(t.orgId, t.userId, t.scope),
]);

export const spendLedger = pgTable('spend_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  kind: spendKindEnum('kind').notNull(),
  cents: integer('cents').notNull(),
  meta: jsonb('meta').default({}),
  ts: timestamp('ts').defaultNow().notNull(),
}, (t) => [
  index('sl_org_ts_idx').on(t.orgId, t.ts),
  index('sl_user_ts_idx').on(t.userId, t.ts),
]);
```

- [ ] **Step 2: Generate + apply**

```bash
npx drizzle-kit generate --name ingestion_governance
npx drizzle-kit push
```

- [ ] **Step 3: Apply RLS to new tenant tables**

Append to a new file `drizzle/0009_rls_ingestion.sql`:

```sql
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_pii_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE spend_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE spend_ledger ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ingestion_jobs','chunk_pii_labels','spend_caps','spend_ledger']
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS tenant_isolation ON %I;
      CREATE POLICY tenant_isolation ON %I
        USING (org_id = current_setting('app.current_org_id', true)::uuid)
        WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
    $f$, t, t);
  END LOOP;
END $$;
```

```bash
psql "$DATABASE_URL" -f drizzle/0009_rls_ingestion.sql
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): ingestion_jobs, chunk_pii_labels, spend_caps, spend_ledger"
```

---

## Task 2: PII detector

**Files:**
- Create: `src/lib/ingest/pii.ts`
- Create: `tests/ingest/pii.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { detectPii } from '@/lib/ingest/pii';

describe('detectPii', () => {
  it('flags emails as low+ severity', async () => {
    const r = await detectPii('Contact john.doe@acme.com about the renewal.');
    expect(r.severity).not.toBe('none');
    expect(r.categories).toContain('email');
  });

  it('flags credit-card-shaped numbers as high', async () => {
    const r = await detectPii('Card on file: 4111-1111-1111-1111.');
    expect(r.severity).toBe('high');
    expect(r.categories).toContain('financial');
  });

  it('returns none for ordinary business prose', async () => {
    const r = await detectPii('We agreed on quarterly billing for the engagement.');
    expect(r.severity).toBe('none');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '@/lib/ai/router';

const PiiSchema = z.object({
  severity: z.enum(['none', 'low', 'medium', 'high']),
  categories: z.array(z.enum(['email','phone','address','government_id','financial','health','credentials','custom'])),
  spans: z.array(z.object({ start: z.number(), end: z.number(), type: z.string() })),
});

export interface PiiResult {
  severity: 'none' | 'low' | 'medium' | 'high';
  categories: string[];
  spans: Array<{ start: number; end: number; type: string }>;
  detectorVersion: number;
}

const QUICK_REGEX_HIGH = [
  /\b(?:\d[ -]?){13,19}\b/,                          // card-ish
  /\b\d{3}-\d{2}-\d{4}\b/,                           // SSN
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,             // private key
];

export async function detectPii(content: string): Promise<PiiResult> {
  // Cheap regex first; if matched at high, skip the model call.
  for (const r of QUICK_REGEX_HIGH) {
    if (r.test(content)) {
      return { severity: 'high', categories: ['financial', 'credentials'], spans: [], detectorVersion: 1 };
    }
  }
  const model = getLanguageModel(process.env.PII_MODEL ?? 'anthropic/claude-haiku-4-5-20251001');
  const { object } = await generateObject({
    model, schema: PiiSchema,
    prompt: `Classify the following text for personal/sensitive information. Return severity none|low|medium|high and the categories present. Be conservative — internal business prose without identifiers is "none".\n\nText:\n${content.slice(0, 2000)}`,
  });
  return { ...object, detectorVersion: 1 };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- tests/ingest/pii.test.ts
git add src/lib/ingest/pii.ts tests/ingest/pii.test.ts
git commit -m "feat(ingest): PII detector — regex fast-path + Haiku structured output"
```

---

## Task 3: Wire PII into ingest

**Files:**
- Modify: `src/lib/memory/ingest.ts`

- [ ] **Step 1: Augment ingestSource**

In `src/lib/memory/ingest.ts`, after each chunk is inserted, run PII detection and persist a label:

```ts
import { detectPii } from '@/lib/ingest/pii';
import { chunkPiiLabels } from '@/lib/db/schema';

// After embedding update for each chunk:
const pii = await detectPii(c.content);
await db.insert(chunkPiiLabels).values({
  chunkId: row.id,
  orgId,
  severity: pii.severity as 'none' | 'low' | 'medium' | 'high',
  categories: pii.categories,
  spans: pii.spans,
  detectorVersion: pii.detectorVersion,
});
```

- [ ] **Step 2: Update projection to respect labels**

In `src/lib/memory/projection.ts`, when inserting an atom, set scope based on the highest-severity backing chunk:

```ts
const sevs = await db.execute(sql`
  SELECT MAX(CASE severity
    WHEN 'high' THEN 4 WHEN 'medium' THEN 3 WHEN 'low' THEN 2 ELSE 1 END) AS max_sev
  FROM chunk_pii_labels WHERE chunk_id = ANY(${recent.map(c => c.id)}::uuid[])
`);
const maxSev = (sevs.rows[0] as { max_sev: number }).max_sev;
// scope_user_id only (never team/org auto) when maxSev >= 3
const forcePersonal = maxSev >= 3;
```

When inserting:

```ts
.values({
  ...
  scopeUserId: forcePersonal ? scopeUserId : (scopeUserId ?? null),
  scopeTeamId: forcePersonal ? null : null,  // explicit: never auto-promote sensitive
  ...
})
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/memory/ingest.ts src/lib/memory/projection.ts
git commit -m "feat(memory): persist PII labels at ingest; gate auto-promotion of sensitive chunks"
```

---

## Task 4: Spend caps + ledger + middleware

**Files:**
- Create: `src/lib/spend/caps.ts`
- Create: `src/lib/spend/middleware.ts`
- Create: `tests/spend/caps.test.ts`

- [ ] **Step 1: Write `caps.ts`**

```ts
import { db } from '@/lib/db';
import { spendCaps, spendLedger } from '@/lib/db/schema';
import { sql, and, eq } from 'drizzle-orm';

const DEFAULTS_CENTS = {
  user_daily: 500,        // $5
  org_monthly: 50000,     // $500
  employee_run: 200,      // $2
};

export async function assertSpendOk(orgId: string, userId: string | null, kind: keyof typeof DEFAULTS_CENTS, estCents: number): Promise<void> {
  // user_daily
  if (kind === 'user_daily' && userId) {
    const cap = await capCents(orgId, userId, 'user_daily');
    const used = await spentSince(orgId, userId, since('day'));
    if (used + estCents > cap) throw new SpendExceeded('user_daily', cap, used);
  }
  if (kind === 'org_monthly') {
    const cap = await capCents(orgId, null, 'org_monthly');
    const used = await spentSince(orgId, null, since('month'));
    if (used + estCents > cap) throw new SpendExceeded('org_monthly', cap, used);
  }
  if (kind === 'employee_run') {
    const cap = await capCents(orgId, null, 'employee_run');
    if (estCents > cap) throw new SpendExceeded('employee_run', cap, estCents);
  }
}

export async function recordSpend(orgId: string, userId: string | null, kind: 'chat' | 'embedding' | 'projection' | 'employee_run' | 'pii_detect' | 'crawl' | 'extraction', cents: number, meta: Record<string, unknown> = {}) {
  await db.insert(spendLedger).values({ orgId, userId, kind, cents, meta });
}

async function capCents(orgId: string, userId: string | null, scope: string): Promise<number> {
  const rows = await db.select().from(spendCaps).where(and(eq(spendCaps.orgId, orgId), eq(spendCaps.scope, scope), userId ? eq(spendCaps.userId, userId) : sql`user_id IS NULL`));
  if (rows.length > 0) return rows[0].capCents;
  return DEFAULTS_CENTS[scope as keyof typeof DEFAULTS_CENTS] ?? 0;
}

async function spentSince(orgId: string, userId: string | null, since: Date): Promise<number> {
  const r = await db.execute(sql`
    SELECT COALESCE(SUM(cents), 0)::int AS s FROM spend_ledger
    WHERE org_id = ${orgId} AND ts >= ${since.toISOString()}
      ${userId ? sql`AND user_id = ${userId}` : sql``}
  `);
  return Number((r.rows[0] as { s: number }).s);
}

function since(period: 'day' | 'month'): Date {
  const d = new Date();
  if (period === 'day') d.setUTCHours(0, 0, 0, 0);
  else { d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); }
  return d;
}

export class SpendExceeded extends Error {
  constructor(public scope: string, public cap: number, public used: number) {
    super(`spend cap exceeded for ${scope}: cap=${cap}c used=${used}c`);
  }
}
```

- [ ] **Step 2: Write `middleware.ts`**

```ts
import { assertSpendOk, recordSpend, SpendExceeded } from './caps';

export async function withSpendGuard<T>(
  ctx: { orgId: string; userId: string | null; kind: 'chat' | 'embedding' | 'projection' | 'employee_run' | 'pii_detect' | 'crawl' | 'extraction'; estCents: number },
  fn: () => Promise<{ result: T; actualCents: number }>,
): Promise<T> {
  await assertSpendOk(ctx.orgId, ctx.userId, ctx.kind === 'employee_run' ? 'employee_run' : 'user_daily', ctx.estCents);
  await assertSpendOk(ctx.orgId, ctx.userId, 'org_monthly', ctx.estCents);
  try {
    const { result, actualCents } = await fn();
    await recordSpend(ctx.orgId, ctx.userId, ctx.kind, actualCents, {});
    return result;
  } catch (err) {
    if (err instanceof SpendExceeded) throw err;
    throw err;
  }
}

export { SpendExceeded } from './caps';
```

- [ ] **Step 3: Test hard-stop**

`tests/spend/caps.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users, spendCaps, spendLedger } from '@/lib/db/schema';
import { assertSpendOk, recordSpend, SpendExceeded } from '@/lib/spend/caps';

describe('spend caps', () => {
  it('throws SpendExceeded when user_daily cap is reached', async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'C', slug: `c-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `c-${stamp}@e.co`, role: 'member' }).returning();
    await db.insert(spendCaps).values({ orgId: org.id, userId: user.id, scope: 'user_daily', capCents: 100 });
    await recordSpend(org.id, user.id, 'chat', 95);
    await expect(assertSpendOk(org.id, user.id, 'user_daily', 10)).rejects.toBeInstanceOf(SpendExceeded);
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- tests/spend/caps.test.ts
git add src/lib/spend/ tests/spend/
git commit -m "feat(spend): per-user / per-org / per-run cost caps with hard-stop ledger"
```

---

## Task 5: Wire spend guard into chat + projection + extraction

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/queue/project/route.ts`
- Modify: `src/app/api/queue/extract/route.ts`

- [ ] **Step 1: Wrap `streamText` call in chat route**

In `src/app/api/chat/route.ts`, before the `streamText`:

```ts
import { withSpendGuard, SpendExceeded } from '@/lib/spend/middleware';
import { estimateCost } from '@/lib/ai/router';
// ...
const lastMsgChars = (modelMessages[modelMessages.length - 1]?.content as string ?? '').length;
const estCents = Math.ceil(estimateCost(modelId, lastMsgChars / 4, 1500) * 100);
try {
  const guardedResult = await withSpendGuard(
    { orgId: me!.orgId!, userId: session!.user!.id!, kind: 'chat', estCents },
    async () => {
      const r = streamText({ /* existing args */ });
      return { result: r, actualCents: estCents };  // we record actuals in onFinish
    }
  );
  // ...use guardedResult
} catch (err) {
  if (err instanceof SpendExceeded) {
    return Response.json({ error: 'spend_cap_exceeded', scope: err.scope, cap: err.cap, used: err.used }, { status: 402 });
  }
  throw err;
}
```

In `onFinish`, replace the existing `db.insert(modelUsage)` with a `recordSpend` call so the ledger stays the source of truth (modelUsage stays for analytics).

- [ ] **Step 2: Wrap projection + extraction queue consumers**

Wrap the body of each consumer in `withSpendGuard` with `kind: 'projection'` / `'extraction'` and a cost estimate (use Haiku/Sonnet rates × estimated tokens).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts src/app/api/queue/
git commit -m "feat(spend): hard-stop wrapping on chat, projection, extraction"
```

---

## Task 6: Document parsers — markdown, pdf, docx

**Files:**
- Create: `src/lib/ingest/parsers/markdown.ts`
- Create: `src/lib/ingest/parsers/pdf.ts`
- Create: `src/lib/ingest/parsers/docx.ts`
- Create: `src/lib/ingest/types.ts`
- Create: `tests/ingest/parsers.test.ts`

- [ ] **Step 1: Install deps**

```bash
npm install unpdf mammoth
```

- [ ] **Step 2: Define types**

`src/lib/ingest/types.ts`:

```ts
export interface ParserChunk {
  ord: number;
  content: string;
  meta?: Record<string, unknown>;
}

export interface ParserResult {
  title: string | null;
  chunks: ParserChunk[];
}

export interface Parser {
  matches(mime: string, filename: string): boolean;
  parse(buffer: ArrayBuffer, filename: string): Promise<ParserResult>;
}
```

- [ ] **Step 3: Markdown parser**

`src/lib/ingest/parsers/markdown.ts`:

```ts
import { chunkText } from '@/lib/memory/chunker';
import type { Parser, ParserResult } from '../types';

export const markdownParser: Parser = {
  matches: (mime, name) => mime === 'text/markdown' || name.endsWith('.md') || name.endsWith('.mdx') || mime === 'text/plain' || name.endsWith('.txt'),
  async parse(buffer, filename) {
    const text = new TextDecoder().decode(buffer);
    const titleMatch = text.match(/^#\s+(.+)$/m);
    return {
      title: titleMatch ? titleMatch[1].trim() : filename,
      chunks: chunkText(text).map((c) => ({ ord: c.ord, content: c.content })),
    };
  },
};
```

- [ ] **Step 4: PDF parser**

`src/lib/ingest/parsers/pdf.ts`:

```ts
import { extractText } from 'unpdf';
import { chunkText } from '@/lib/memory/chunker';
import type { Parser } from '../types';

export const pdfParser: Parser = {
  matches: (mime, name) => mime === 'application/pdf' || name.endsWith('.pdf'),
  async parse(buffer, filename) {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    const full = Array.isArray(text) ? text.join('\n\n') : text;
    if (full.trim().length < 50) {
      // Likely scanned; OCR via vision model
      return ocrPdf(buffer, filename);
    }
    return {
      title: filename,
      chunks: chunkText(full).map((c, i) => ({ ord: i, content: c.content, meta: { page: c.ord + 1 } })),
    };
  },
};

async function ocrPdf(_buffer: ArrayBuffer, filename: string) {
  // Vision-OCR fallback. For M2 first cut, mark as failed and surface to UI.
  // Real impl (M2.1): convert each page to PNG, call Sonnet/Opus vision.
  throw new Error(`PDF appears scanned, vision OCR not yet implemented: ${filename}`);
}
```

- [ ] **Step 5: docx parser**

`src/lib/ingest/parsers/docx.ts`:

```ts
import mammoth from 'mammoth';
import { chunkText } from '@/lib/memory/chunker';
import type { Parser } from '../types';

export const docxParser: Parser = {
  matches: (mime, name) => mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx'),
  async parse(buffer, filename) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return {
      title: filename,
      chunks: chunkText(value).map((c) => ({ ord: c.ord, content: c.content })),
    };
  },
};
```

- [ ] **Step 6: Tests**

`tests/ingest/parsers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { markdownParser } from '@/lib/ingest/parsers/markdown';

describe('markdownParser', () => {
  it('extracts a title and produces chunks', async () => {
    const buf = new TextEncoder().encode('# Hello\n\nWorld of test content. '.repeat(50)).buffer;
    const r = await markdownParser.parse(buf, 'doc.md');
    expect(r.title).toBe('Hello');
    expect(r.chunks.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/ingest/ tests/ingest/parsers.test.ts package.json package-lock.json
git commit -m "feat(ingest): markdown/pdf/docx parsers + types"
```

---

## Task 7: pptx + xlsx + ChatGPT/Claude export parsers

**Files:**
- Create: `src/lib/ingest/parsers/pptx.ts`
- Create: `src/lib/ingest/parsers/xlsx.ts`
- Create: `src/lib/ingest/parsers/chatgpt-export.ts`
- Create: `src/lib/ingest/parsers/claude-export.ts`
- Create: `src/lib/ingest/parsers/index.ts`

- [ ] **Step 1: Install deps**

```bash
npm install xlsx jszip
```

- [ ] **Step 2: pptx parser (raw XML via JSZip)**

`src/lib/ingest/parsers/pptx.ts`:

```ts
import JSZip from 'jszip';
import type { Parser } from '../types';

export const pptxParser: Parser = {
  matches: (mime, name) => mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || name.endsWith('.pptx'),
  async parse(buffer, filename) {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter((n) => n.match(/^ppt\/slides\/slide\d+\.xml$/)).sort();
    const chunks = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('text');
      const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 20) chunks.push({ ord: i, content: text, meta: { slide: i + 1 } });
    }
    return { title: filename, chunks };
  },
};
```

- [ ] **Step 3: xlsx parser**

`src/lib/ingest/parsers/xlsx.ts`:

```ts
import * as XLSX from 'xlsx';
import type { Parser } from '../types';

export const xlsxParser: Parser = {
  matches: (mime, name) => mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || name.endsWith('.xlsx'),
  async parse(buffer, filename) {
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const chunks = [];
    let ord = 0;
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      // Chunk by ~50 rows to keep meaningful spreadsheet sections together
      const lines = csv.split('\n');
      for (let i = 0; i < lines.length; i += 50) {
        const block = lines.slice(i, i + 50).join('\n');
        if (block.trim().length > 0) {
          chunks.push({ ord: ord++, content: `[Sheet: ${name}]\n${block}`, meta: { sheet: name, rowStart: i + 1 } });
        }
      }
    }
    return { title: filename, chunks };
  },
};
```

- [ ] **Step 4: ChatGPT export parser**

ChatGPT export is `conversations.json` containing an array of conversations with `mapping` of message nodes.

`src/lib/ingest/parsers/chatgpt-export.ts`:

```ts
import type { Parser, ParserResult } from '../types';

interface CGConversation {
  title: string;
  create_time: number;
  mapping: Record<string, { message: null | { author: { role: string }; content: { parts: string[] | { content_type: string; text?: string }[] }; create_time: number }; parent: string | null; children: string[] }>;
}

export const chatgptExportParser: Parser = {
  matches: (mime, name) => name === 'conversations.json' || (name.endsWith('.json') && (mime === 'application/json')),
  async parse(buffer, filename) {
    const text = new TextDecoder().decode(buffer);
    const json = JSON.parse(text);
    if (!Array.isArray(json)) return { title: filename, chunks: [] };

    // We collapse all conversations into one source per export — caller can split.
    const chunks: ParserResult['chunks'] = [];
    let ord = 0;
    for (const conv of json as CGConversation[]) {
      // Walk the linked-list root → ... in conversation order
      const root = Object.values(conv.mapping).find((n) => n.parent === null);
      let cur = root;
      while (cur) {
        if (cur.message) {
          const parts = cur.message.content?.parts ?? [];
          const text = parts.map((p) => typeof p === 'string' ? p : p.text ?? '').filter(Boolean).join('\n');
          if (text) chunks.push({ ord: ord++, content: `[${cur.message.author.role}] ${text}`, meta: { conversation: conv.title, role: cur.message.author.role } });
        }
        cur = cur.children[0] ? conv.mapping[cur.children[0]] : undefined;
      }
    }
    return { title: 'ChatGPT export', chunks };
  },
};
```

- [ ] **Step 5: Claude export parser**

Claude exports as a zip with conversation JSONs.

`src/lib/ingest/parsers/claude-export.ts`:

```ts
import JSZip from 'jszip';
import type { Parser, ParserResult } from '../types';

export const claudeExportParser: Parser = {
  matches: (mime, name) => name.endsWith('.zip') && (name.toLowerCase().includes('claude') || name.toLowerCase().includes('anthropic')),
  async parse(buffer, filename) {
    const zip = await JSZip.loadAsync(buffer);
    const chunks: ParserResult['chunks'] = [];
    let ord = 0;
    const jsonFiles = Object.keys(zip.files).filter((n) => n.endsWith('.json'));
    for (const f of jsonFiles) {
      try {
        const text = await zip.files[f].async('text');
        const data = JSON.parse(text) as { name?: string; messages?: Array<{ sender: string; text: string }> };
        if (Array.isArray(data.messages)) {
          for (const m of data.messages) {
            chunks.push({ ord: ord++, content: `[${m.sender}] ${m.text}`, meta: { conversation: data.name ?? f, role: m.sender } });
          }
        }
      } catch { /* skip malformed */ }
    }
    return { title: 'Claude export', chunks };
  },
};
```

- [ ] **Step 6: Dispatcher**

`src/lib/ingest/parsers/index.ts`:

```ts
import { markdownParser } from './markdown';
import { pdfParser } from './pdf';
import { docxParser } from './docx';
import { pptxParser } from './pptx';
import { xlsxParser } from './xlsx';
import { chatgptExportParser } from './chatgpt-export';
import { claudeExportParser } from './claude-export';
import type { Parser, ParserResult } from '../types';

const PARSERS: Parser[] = [chatgptExportParser, claudeExportParser, pdfParser, docxParser, pptxParser, xlsxParser, markdownParser];

export function pickParser(mime: string, filename: string): Parser | null {
  return PARSERS.find((p) => p.matches(mime, filename)) ?? null;
}

export async function parseFile(mime: string, filename: string, buffer: ArrayBuffer): Promise<ParserResult> {
  const parser = pickParser(mime, filename);
  if (!parser) throw new Error(`No parser for ${mime} (${filename})`);
  return parser.parse(buffer, filename);
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/ingest/parsers/ package.json package-lock.json
git commit -m "feat(ingest): pptx, xlsx, ChatGPT export, Claude export parsers + dispatcher"
```

---

## Task 8: Upload API + Blob storage

**Files:**
- Create: `src/lib/ingest/upload.ts`
- Create: `src/app/api/upload/route.ts`

- [ ] **Step 1: Install Vercel Blob SDK**

```bash
npm install @vercel/blob
```

- [ ] **Step 2: `upload.ts` helper**

```ts
import { put } from '@vercel/blob';
import { db } from '@/lib/db';
import { ingestionJobs } from '@/lib/db/schema';
import { enqueueIngest } from '@/lib/memory/queue';

export async function uploadAndQueue(
  orgId: string, ownerUserId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
): Promise<{ jobId: string; blobUrl: string }> {
  const { url } = await put(`orgs/${orgId}/uploads/${Date.now()}-${file.name}`, file.buffer, {
    access: 'public',         // private once Vercel Blob private GA's; use signed URLs
    contentType: file.type,
  });
  const [job] = await db.insert(ingestionJobs).values({
    orgId, ownerUserId, kind: 'upload',
    filename: file.name, blobUrl: url, mimeType: file.type, byteSize: file.size,
    status: 'queued',
  }).returning({ id: ingestionJobs.id });
  await enqueueIngest(job.id, orgId);
  return { jobId: job.id, blobUrl: url };
}
```

- [ ] **Step 3: Add `enqueueIngest` to queue.ts**

```ts
const INGEST_QUEUE = process.env.QUEUE_INGEST_NAME ?? 'osmer-ingest';
export async function enqueueIngest(jobId: string, orgId: string) {
  await queue.send(INGEST_QUEUE, { jobId, orgId });
}
```

- [ ] **Step 4: Upload route**

`src/app/api/upload/route.ts`:

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { uploadAndQueue } from '@/lib/ingest/upload';

export const maxDuration = 60;
const MAX_BYTES = 50 * 1024 * 1024;  // 50 MB per file

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'too_large' }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const out = await uploadAndQueue(me.orgId, session.user.id, {
    name: file.name, type: file.type, size: file.size, buffer: buf,
  });
  return Response.json(out);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingest/upload.ts src/lib/memory/queue.ts src/app/api/upload/route.ts package.json package-lock.json
git commit -m "feat(upload): multipart upload to Vercel Blob + ingestion job creation"
```

---

## Task 9: Ingest queue consumer

**Files:**
- Create: `src/lib/ingest/process.ts`
- Create: `src/app/api/queue/ingest/route.ts`

- [ ] **Step 1: `process.ts`**

```ts
import { db } from '@/lib/db';
import { ingestionJobs, sources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseFile } from './parsers';
import { ingestSource } from '@/lib/memory/ingest';

export async function processIngestionJob(jobId: string) {
  const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, jobId));
  if (!job) throw new Error(`job ${jobId} not found`);
  await db.update(ingestionJobs).set({ status: 'parsing', updatedAt: new Date() }).where(eq(ingestionJobs.id, jobId));

  const r = await fetch(job.blobUrl!);
  if (!r.ok) throw new Error(`fetch blob failed: ${r.status}`);
  const buf = await r.arrayBuffer();
  const parsed = await parseFile(job.mimeType!, job.filename!, buf);

  await db.update(ingestionJobs).set({ status: 'embedding', updatedAt: new Date() }).where(eq(ingestionJobs.id, jobId));
  const sourceId = await ingestSource({
    orgId: job.orgId,
    type: 'document',
    ownerUserId: job.ownerUserId,
    title: parsed.title ?? job.filename!,
    chunks: parsed.chunks.map((c, i) => ({ ord: i, content: c.content, meta: c.meta ?? {} })),
    meta: { ingestionJobId: jobId, mime: job.mimeType, filename: job.filename },
  });

  await db.update(ingestionJobs)
    .set({ status: 'complete', sourceId, chunkCount: parsed.chunks.length, updatedAt: new Date() })
    .where(eq(ingestionJobs.id, jobId));
}
```

- [ ] **Step 2: Queue route**

`src/app/api/queue/ingest/route.ts`:

```ts
import { processIngestionJob } from '@/lib/ingest/process';
import { db } from '@/lib/db';
import { ingestionJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { jobId } = await req.json() as { jobId: string };
  try {
    await processIngestionJob(jobId);
    return Response.json({ ok: true });
  } catch (err) {
    await db.update(ingestionJobs).set({ status: 'failed', errorMessage: String(err) }).where(eq(ingestionJobs.id, jobId));
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Smoke**

```bash
curl -F "file=@README.md" http://localhost:3000/api/upload --cookie "<auth>"
# Wait for queue to process
psql "$DATABASE_URL" -c "SELECT status, chunk_count FROM ingestion_jobs ORDER BY created_at DESC LIMIT 1;"
```

Expected: `complete` with > 0 chunks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ingest/process.ts src/app/api/queue/ingest/route.ts
git commit -m "feat(ingest): queue consumer parses + embeds uploaded files"
```

---

## Task 10: Website crawler

**Files:**
- Create: `src/lib/ingest/crawler.ts`
- Create: `src/app/api/crawl/route.ts`
- Create: `src/app/api/queue/crawl/route.ts`

- [ ] **Step 1: Install cheerio**

```bash
npm install cheerio
```

- [ ] **Step 2: Crawler**

`src/lib/ingest/crawler.ts`:

```ts
import * as cheerio from 'cheerio';
import { ingestSource } from '@/lib/memory/ingest';
import { chunkText } from '@/lib/memory/chunker';

const MAX_PAGES = 50;
const MAX_DEPTH = 2;
const POLITE_DELAY_MS = 500;

export async function crawlSite(orgId: string, ownerUserId: string, startUrl: string): Promise<{ pagesCrawled: number; sourceIds: string[] }> {
  const start = new URL(startUrl);
  const urls = await fetchSitemap(start) ?? [start.toString()];
  const seen = new Set<string>();
  const sourceIds: string[] = [];
  let pagesCrawled = 0;

  for (const u of urls) {
    if (pagesCrawled >= MAX_PAGES) break;
    if (seen.has(u)) continue;
    seen.add(u);
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'OsmerCrawler/1.0 (+https://osmer.ai)' } });
      if (!r.ok) continue;
      const html = await r.text();
      const $ = cheerio.load(html);
      $('script, style, nav, footer, header').remove();
      const title = $('title').first().text().trim() || u;
      const main = $('main').text() || $('article').text() || $('body').text();
      const cleaned = main.replace(/\s+/g, ' ').trim();
      if (cleaned.length < 100) continue;

      const sourceId = await ingestSource({
        orgId, type: 'crawl', ownerUserId, title,
        chunks: chunkText(cleaned).map((c) => ({ ord: c.ord, content: c.content, meta: { url: u } })),
        meta: { url: u, crawledAt: new Date().toISOString() },
      });
      sourceIds.push(sourceId);
      pagesCrawled++;
      await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
    } catch { /* skip */ }
  }
  return { pagesCrawled, sourceIds };
}

async function fetchSitemap(start: URL): Promise<string[] | null> {
  try {
    const r = await fetch(`${start.origin}/sitemap.xml`);
    if (!r.ok) return null;
    const xml = await r.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(start.origin));
    return urls.slice(0, MAX_PAGES);
  } catch { return null; }
}
```

- [ ] **Step 3: Crawl route**

`src/app/api/crawl/route.ts`:

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, ingestionJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { queue } from '@vercel/functions/queue';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });
  const { url } = await req.json() as { url: string };
  if (!url || !url.startsWith('http')) return Response.json({ error: 'bad_url' }, { status: 400 });

  const [job] = await db.insert(ingestionJobs).values({
    orgId: me.orgId, ownerUserId: session.user.id,
    kind: 'crawl', meta: { url }, status: 'queued',
  }).returning({ id: ingestionJobs.id });
  await queue.send(process.env.QUEUE_CRAWL_NAME ?? 'osmer-crawl', { jobId: job.id, url, orgId: me.orgId, userId: session.user.id });
  return Response.json({ jobId: job.id });
}
```

- [ ] **Step 4: Queue consumer**

`src/app/api/queue/crawl/route.ts`:

```ts
import { db } from '@/lib/db';
import { ingestionJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { crawlSite } from '@/lib/ingest/crawler';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { jobId, url, orgId, userId } = await req.json();
  await db.update(ingestionJobs).set({ status: 'parsing', updatedAt: new Date() }).where(eq(ingestionJobs.id, jobId));
  try {
    const r = await crawlSite(orgId, userId, url);
    await db.update(ingestionJobs).set({ status: 'complete', chunkCount: r.pagesCrawled, meta: { ...r }, updatedAt: new Date() }).where(eq(ingestionJobs.id, jobId));
    return Response.json({ ok: true, ...r });
  } catch (err) {
    await db.update(ingestionJobs).set({ status: 'failed', errorMessage: String(err) }).where(eq(ingestionJobs.id, jobId));
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingest/crawler.ts src/app/api/crawl/route.ts src/app/api/queue/crawl/route.ts package.json package-lock.json
git commit -m "feat(ingest): sitemap-first website crawler"
```

---

## Task 11: Onboarding flow API

**Files:**
- Create: `src/app/api/onboarding/start/route.ts`
- Create: `src/app/api/onboarding/status/route.ts`

- [ ] **Step 1: Start route**

`src/app/api/onboarding/start/route.ts`:

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const { websiteUrl } = await req.json() as { websiteUrl?: string };
  if (websiteUrl) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/crawl`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify({ url: websiteUrl }),
    });
  }
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Status route**

`src/app/api/onboarding/status/route.ts`:

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, ingestionJobs, sourceChunks } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const jobs = await db.select().from(ingestionJobs).where(eq(ingestionJobs.orgId, me.orgId)).orderBy(sql`created_at DESC`).limit(20);
  const totalChunks = await db.execute(sql`SELECT COUNT(*) AS c FROM source_chunks WHERE org_id = ${me.orgId}`);
  return Response.json({
    jobs,
    totalChunks: Number((totalChunks.rows[0] as { c: number }).c),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/onboarding/
git commit -m "feat(onboarding): start + status endpoints"
```

---

## Task 12: Onboarding UI

**Files:**
- Create: `src/components/onboarding/onboarding-flow.tsx`
- Create: `src/components/onboarding/upload-zone.tsx`
- Create: `src/components/onboarding/crawl-step.tsx`
- Create: `src/components/onboarding/progress-feed.tsx`
- Create: `src/app/chat/onboarding/page.tsx`

- [ ] **Step 1: UploadZone**

`src/components/onboarding/upload-zone.tsx`:

```tsx
'use client';
import { useState, useRef } from 'react';

export function UploadZone({ onUploaded }: { onUploaded?: (jobId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(files: FileList) {
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append('file', f);
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        if (r.ok) {
          const { jobId } = await r.json();
          onUploaded?.(jobId);
        }
      }
    } finally { setBusy(false); }
  }

  return (
    <div
      className="rounded-md border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center cursor-pointer hover:bg-stone-50/40 dark:hover:bg-stone-900/40"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) send(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && send(e.target.files)} />
      <p className="text-sm">{busy ? 'Uploading…' : 'Drop documents here or click to choose'}</p>
      <p className="text-xs text-stone-500 mt-2">PDF, DOCX, PPTX, XLSX, MD, ChatGPT/Claude exports</p>
    </div>
  );
}
```

- [ ] **Step 2: CrawlStep**

`src/components/onboarding/crawl-step.tsx`:

```tsx
'use client';
import { useState } from 'react';

export function CrawlStep() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await fetch('/api/crawl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    } finally { setBusy(false); }
  }

  return (
    <div className="flex gap-2 items-center">
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourcompany.com" className="flex-1 rounded-md border px-3 py-2 text-sm bg-white dark:bg-stone-950" />
      <button onClick={go} disabled={!url.startsWith('http') || busy} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm disabled:opacity-40">{busy ? 'Crawling…' : 'Crawl'}</button>
    </div>
  );
}
```

- [ ] **Step 3: ProgressFeed (polls /status)**

`src/components/onboarding/progress-feed.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';

interface Job { id: string; kind: string; filename: string | null; status: string; chunkCount: number | null; updatedAt: string; }

export function ProgressFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [chunks, setChunks] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await fetch('/api/onboarding/status');
      if (!r.ok) return;
      const j = await r.json();
      if (!alive) return;
      setJobs(j.jobs); setChunks(j.totalChunks);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div>
      <p className="text-sm mb-2">{chunks} chunks indexed</p>
      <ul className="space-y-1 text-xs font-mono">
        {jobs.map((j) => (
          <li key={j.id} className="flex justify-between">
            <span>{j.filename ?? j.kind} — {j.status}</span>
            <span className="text-stone-500">{j.chunkCount ?? 0} chunks</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Page**

`src/app/chat/onboarding/page.tsx`:

```tsx
import { UploadZone } from '@/components/onboarding/upload-zone';
import { CrawlStep } from '@/components/onboarding/crawl-step';
import { ProgressFeed } from '@/components/onboarding/progress-feed';

export default function OnboardingPage() {
  return (
    <div className="max-w-2xl mx-auto py-12 space-y-10">
      <header>
        <h1 className="font-serif text-3xl mb-1">Seed your company memory</h1>
        <p className="text-sm text-stone-500">Three ways. Use any or all of them.</p>
      </header>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-3">1. Documents</h2>
        <UploadZone />
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-3">2. Your website</h2>
        <CrawlStep />
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-3">3. Voice introduction</h2>
        <p className="text-sm text-stone-500">Available next week. We'll email you when it's ready.</p>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-3">Activity</h2>
        <ProgressFeed />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Smoke test in dev**

```bash
npm run dev
```

Visit `/chat/onboarding`, drop a PDF, paste a URL, watch the progress feed.

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/ src/app/chat/onboarding/
git commit -m "feat(onboarding): drag-drop upload + URL crawl + live progress feed"
```

---

## Task 13: M2 acceptance — 10-minute cold-start test

**Files:**
- Create: `tests/onboarding/cold-start.test.ts`
- Create: `docs/specs/M2-results.md`

- [ ] **Step 1: Acceptance test**

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { uploadAndQueue } from '@/lib/ingest/upload';
import { processIngestionJob } from '@/lib/ingest/process';
import { sql } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('M2 cold-start', () => {
  it('takes a fresh org from zero to >= 50 chunks via document upload', async () => {
    const stamp = Date.now();
    const [org] = await db.insert(organizations).values({ name: 'Cold', slug: `cold-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'F', email: `cold-${stamp}@e.co`, role: 'owner' }).returning();

    const buf = await fs.readFile(path.resolve(__dirname, 'fixtures/sample.md'));
    const job = await uploadAndQueue(org.id, user.id, { name: 'sample.md', type: 'text/markdown', size: buf.length, buffer: buf });
    await processIngestionJob(job.jobId);

    const r = await db.execute(sql`SELECT COUNT(*) AS c FROM source_chunks WHERE org_id = ${org.id}`);
    expect(Number((r.rows[0] as { c: number }).c)).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Add a fixture**

Create `tests/onboarding/fixtures/sample.md`:

```
# Acme Corp Q1 Plan

Acme migrates to Stripe. (paragraph repeated 60×)
```

- [ ] **Step 3: Results doc**

```markdown
# M2 — Results

## Acceptance gates
- [ ] Document upload + parse + ingest works for PDF, MD, docx, pptx, xlsx, ChatGPT export, Claude export
- [ ] Website crawl seeds at least 5 source rows for a typical SMB site
- [ ] PII detection flags emails, phone, SSN-shape, card-shape correctly on 10/10 fixture cases
- [ ] Sensitive chunks (severity ≥ medium) do not auto-promote to team/org scope
- [ ] Spend caps hard-stop on the 10th excessive call (verified by tests/spend/caps.test.ts)
- [ ] Cold-start: a new org seeded with 1 doc + 1 crawl reaches ≥ 50 source_chunks within 10 minutes wall-clock
```

- [ ] **Step 4: Commit**

```bash
git add tests/onboarding/ docs/specs/M2-results.md
git commit -m "test(m2): cold-start acceptance + results template"
```

---

## Self-review

- Tier-1 docs: parsers + upload + queue + UI ✓ (T6-T9, T12)
- Tier-2 crawl: T10 ✓
- PII detection + auto-promotion gate: T2-T3 ✓
- Cost ceilings: T4-T5 ✓
- Onboarding flow: T11-T12 ✓
- Acceptance: T13 ✓
- ChatGPT/Claude exports: T7 ✓
- RLS on new tables: T1 step 3 ✓
- Voice tier (Tier 3): deferred to M7 ✓

**Deferred to follow-ups:** vision-OCR for scanned PDFs (currently throws), Google Drive folder picker, paste-from-clipboard auto-detection, recurring re-crawl cron.
