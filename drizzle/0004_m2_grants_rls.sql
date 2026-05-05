-- M2: grants for new tables to osmer_app + RLS policies.
-- Run via DATABASE_URL_OWNER (the owner has BYPASSRLS and can issue these).

GRANT ALL ON TABLE ingestion_jobs    TO osmer_app;
GRANT ALL ON TABLE chunk_pii_labels  TO osmer_app;
GRANT ALL ON TABLE spend_caps        TO osmer_app;
GRANT ALL ON TABLE spend_ledger      TO osmer_app;

ALTER TABLE ingestion_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_pii_labels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE spend_caps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE spend_ledger      ENABLE ROW LEVEL SECURITY;

ALTER TABLE ingestion_jobs    FORCE ROW LEVEL SECURITY;
ALTER TABLE chunk_pii_labels  FORCE ROW LEVEL SECURITY;
ALTER TABLE spend_caps        FORCE ROW LEVEL SECURITY;
ALTER TABLE spend_ledger      FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
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
