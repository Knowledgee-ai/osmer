-- M1 raw additions: pgvector, pg_trgm, vector + tsvector columns, HNSW + GIN indexes.
-- Idempotent — safe to re-run.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Vector columns
ALTER TABLE source_chunks   ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE memory_atoms    ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE memory_entities ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Generated tsvector column on source_chunks for FTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'source_chunks' AND column_name = 'tsv'
  ) THEN
    ALTER TABLE source_chunks
      ADD COLUMN tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
  END IF;
END $$;

-- HNSW indexes for vector cosine search
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
  ON source_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS atoms_embedding_hnsw
  ON memory_atoms  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS entities_embedding_hnsw
  ON memory_entities USING hnsw (embedding vector_cosine_ops);

-- GIN index on tsv for FTS
CREATE INDEX IF NOT EXISTS chunks_tsv_gin
  ON source_chunks USING gin (tsv);

-- Trigram index on entity name for fuzzy lookup
CREATE INDEX IF NOT EXISTS entities_name_trgm
  ON memory_entities USING gin (name gin_trgm_ops);
