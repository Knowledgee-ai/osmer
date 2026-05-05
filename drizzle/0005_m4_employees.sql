-- M4: AI Employees runtime tables.
-- Idempotent — safe to re-run. Apply via run-sql-as-owner.ts; do NOT
-- use `drizzle-kit push` (it strips RLS + custom types — see drizzle/README.md).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status') THEN
    CREATE TYPE employee_status AS ENUM ('active', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
    CREATE TYPE run_status AS ENUM ('queued','running','awaiting_approval','complete','failed','canceled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name varchar(255) NOT NULL,
  description text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '[]',
  toolbelt jsonb NOT NULL DEFAULT '[]',
  example_source_ids jsonb NOT NULL DEFAULT '[]',
  memory_scope jsonb NOT NULL DEFAULT '{"kind":"org"}',
  shared boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  status employee_status NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emp_org_idx   ON employees (org_id);
CREATE INDEX IF NOT EXISTS emp_owner_idx ON employees (owner_user_id);

CREATE TABLE IF NOT EXISTS employee_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  inputs jsonb NOT NULL,
  status run_status NOT NULL DEFAULT 'queued',
  started_at timestamp,
  completed_at timestamp,
  output_text text,
  output_blob_url text,
  cost real,
  steps jsonb NOT NULL DEFAULT '[]',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_emp_idx    ON employee_runs (employee_id);
CREATE INDEX IF NOT EXISTS runs_org_idx    ON employee_runs (org_id);
CREATE INDEX IF NOT EXISTS runs_status_idx ON employee_runs (status);

CREATE TABLE IF NOT EXISTS irreversible_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES employee_runs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tool_id varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  decided_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tool_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES employee_runs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tool_id varchar(64) NOT NULL,
  args jsonb NOT NULL,
  result jsonb,
  error_message text,
  duration_ms integer,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ta_run_idx  ON tool_audit (run_id);
CREATE INDEX IF NOT EXISTS ta_tool_idx ON tool_audit (tool_id);

CREATE TABLE IF NOT EXISTS mcp_tokens (
  token text PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  revoked_at timestamp
);
CREATE INDEX IF NOT EXISTS mcp_org_idx ON mcp_tokens (org_id);

GRANT ALL ON TABLE employees              TO osmer_app;
GRANT ALL ON TABLE employee_runs          TO osmer_app;
GRANT ALL ON TABLE irreversible_approvals TO osmer_app;
GRANT ALL ON TABLE tool_audit             TO osmer_app;
GRANT ALL ON TABLE mcp_tokens             TO osmer_app;

ALTER TABLE employees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE irreversible_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_audit             ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tokens             ENABLE ROW LEVEL SECURITY;

ALTER TABLE employees              FORCE ROW LEVEL SECURITY;
ALTER TABLE employee_runs          FORCE ROW LEVEL SECURITY;
ALTER TABLE irreversible_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE tool_audit             FORCE ROW LEVEL SECURITY;
ALTER TABLE mcp_tokens             FORCE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['employees','employee_runs','irreversible_approvals','tool_audit','mcp_tokens']
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS tenant_isolation ON %I;
      CREATE POLICY tenant_isolation ON %I
        USING (org_id = current_setting('app.current_org_id', true)::uuid)
        WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
    $f$, t, t);
  END LOOP;
END $$;
