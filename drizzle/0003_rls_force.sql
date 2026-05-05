-- Neon's default role (neondb_owner) is the table owner and has BYPASSRLS.
-- Without FORCE, the policy is not enforced for table owners. FORCE makes
-- RLS apply even to the owner — closing the gap.

ALTER TABLE sources           FORCE ROW LEVEL SECURITY;
ALTER TABLE source_chunks     FORCE ROW LEVEL SECURITY;
ALTER TABLE memory_atoms      FORCE ROW LEVEL SECURITY;
ALTER TABLE memory_entities   FORCE ROW LEVEL SECURITY;
ALTER TABLE entity_links      FORCE ROW LEVEL SECURITY;
ALTER TABLE memory_snapshots  FORCE ROW LEVEL SECURITY;
