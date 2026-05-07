-- M7 — voice onboarding sessions
-- Founder interview (~25min) + per-employee intro (~5min) flows.
-- Realtime API drives the live conversation; Whisper offline produces
-- the gold transcript that supersedes the realtime transcript on
-- completion. Final ingest creates a source of type='interview'.

DO $$ BEGIN
  CREATE TYPE voice_flow AS ENUM ('founder_interview', 'employee_intro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE voice_status AS ENUM ('active', 'completed', 'transcribing', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  flow voice_flow NOT NULL,
  status voice_status NOT NULL DEFAULT 'active',
  audio_blob_url text,
  realtime_transcript text,
  whisper_transcript text,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  duration_ms integer,
  started_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);

CREATE INDEX IF NOT EXISTS vs_org_idx ON voice_sessions (org_id);
CREATE INDEX IF NOT EXISTS vs_user_idx ON voice_sessions (user_id);

GRANT ALL ON TABLE voice_sessions TO osmer_app;

ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON voice_sessions;
CREATE POLICY tenant_isolation ON voice_sessions
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
