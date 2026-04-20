-- ─────────────────────────────────────────────────────────────
-- Phase 7 — client_actions column alignment
--
-- The first pass of migration 020 created client_actions with columns
-- {body, ip_hash} and no team_id. The server actions in
-- app/share/[token]/actions.ts and our tests expect
-- {team_id, note, client_name, ip}.
--
-- This patch is additive, idempotent, and safe to re-run:
--   • adds team_id (FK → teams, ON DELETE CASCADE) + backfills
--   • adds client_name, ip, note
--   • leaves body / ip_hash in place (nullable) so older scripts still work
--   • adds (team_id, created_at DESC) index for lead-audit queries
-- ─────────────────────────────────────────────────────────────

-- 1. team_id ------------------------------------------------------
ALTER TABLE client_actions
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;

-- Backfill any existing rows from the parent project.
UPDATE client_actions ca
   SET team_id = p.team_id
  FROM projects p
 WHERE ca.project_id = p.id
   AND ca.team_id IS NULL;

-- 2. other fields --------------------------------------------------
ALTER TABLE client_actions ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE client_actions ADD COLUMN IF NOT EXISTS ip          text;
ALTER TABLE client_actions ADD COLUMN IF NOT EXISTS note        text;

-- 3. helpful index -------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_client_actions_team
  ON client_actions(team_id, created_at DESC)
  WHERE team_id IS NOT NULL;

-- 4. tighten RLS ---------------------------------------------------
-- Now that team_id exists we can read it straight off the row instead
-- of joining to projects on every check. Faster + works on rows where
-- the project has been deleted (CASCADE will remove them anyway, so
-- this is purely a micro-optimisation).
DROP POLICY IF EXISTS client_actions_select ON client_actions;
CREATE POLICY client_actions_select ON client_actions FOR SELECT TO authenticated
  USING (
    public.is_site_admin()
    OR team_id = public.current_team_id()
  );

-- Done.
