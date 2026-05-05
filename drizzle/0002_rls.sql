-- M1 RLS: enable row-level security on every tenanted memory table.
-- Policy keys off `app.current_org_id` GUC, set per-transaction by withTenant().
-- Idempotent — safe to re-run.

ALTER TABLE sources           ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_atoms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_snapshots  ENABLE ROW LEVEL SECURITY;

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
