import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

describe('M1 schema', () => {
  it('has source_chunks with embedding + tsv columns', async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'source_chunks' AND column_name IN ('embedding','tsv')
      ORDER BY column_name
    `);
    const cols = (result.rows as Array<{ column_name: string }>).map((r) => r.column_name);
    expect(cols).toEqual(['embedding', 'tsv']);
  });

  it('has HNSW index on chunks embedding', async () => {
    const result = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'source_chunks' AND indexname = 'chunks_embedding_hnsw'
    `);
    expect(result.rows.length).toBe(1);
  });

  it('has GIN index on tsv', async () => {
    const result = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'source_chunks' AND indexname = 'chunks_tsv_gin'
    `);
    expect(result.rows.length).toBe(1);
  });

  it('has trigram index on entity name', async () => {
    const result = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'memory_entities' AND indexname = 'entities_name_trgm'
    `);
    expect(result.rows.length).toBe(1);
  });

  it('has memory_atoms, memory_entities, memory_snapshots, sources tables', async () => {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('memory_atoms','memory_entities','memory_snapshots','sources','source_chunks','entity_links')
    `);
    expect(result.rows.length).toBe(6);
  });
});
