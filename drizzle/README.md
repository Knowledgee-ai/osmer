# Migration discipline

**Do not run `drizzle-kit push` against this database.**

Drizzle-kit's diff engine doesn't understand:
- pgvector columns (`embedding vector(1536)`) — even with our customType
  it sometimes reports them as drift and offers to drop
- Generated tsvector columns (`tsv tsvector GENERATED ALWAYS AS (...) STORED`)
- Postgres row-level security policies
- Force-RLS attributes
- HNSW / GIN / trigram indexes

Pushing without `--force` triggers an interactive prompt; with `--force`
it silently drops these objects. We've been bitten twice.

## How to add a new table or column

1. Add the Drizzle definition in `src/lib/db/schema.ts`.
2. Hand-write the SQL migration as `drizzle/NNNN_description.sql`.
3. Apply it with `npx tsx scripts/run-sql-as-owner.ts drizzle/NNNN_description.sql`.
4. If it adds a tenant-scoped table, also write a follow-up migration that
   ENABLE+FORCE row-level security and creates a `tenant_isolation` policy.

`drizzle-kit generate` is fine for read-only inspection — just don't apply
its output without manual review.
