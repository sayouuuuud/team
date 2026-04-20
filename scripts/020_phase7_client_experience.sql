-- ─────────────────────────────────────────────────────────────
-- Phase 7 — Client experience patch (additive, idempotent)
--   1. teams.logo_url / accent_color          → branding
--   2. projects.share_views / share_last_viewed_at → share telemetry
--   3. client_actions table                   → approve / reject audit
-- ─────────────────────────────────────────────────────────────

-- 1. Team branding -------------------------------------------------
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url     text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS accent_color text;

-- Accept only empty or CSS-hex values; keeps the UI simple.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teams_accent_color_chk'
  ) THEN
    ALTER TABLE teams
      ADD CONSTRAINT teams_accent_color_chk
      CHECK (accent_color IS NULL
             OR accent_color ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END $$;

-- 2. Project share telemetry --------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_views            int         NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_last_viewed_at   timestamptz;

-- 3. Client actions audit -----------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_action_kind') THEN
    CREATE TYPE client_action_kind AS ENUM ('approve','reject','comment','view');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS client_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  milestone_id uuid          REFERENCES milestones(id) ON DELETE CASCADE,
  kind         client_action_kind NOT NULL,
  body         text,
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_actions_project
  ON client_actions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_actions_milestone
  ON client_actions(milestone_id) WHERE milestone_id IS NOT NULL;

-- The share page reads/writes via service client (token-guarded) so we
-- lock the table down from authenticated users: only site admins can
-- touch it directly, everything else goes through server actions.
ALTER TABLE client_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_actions_select ON client_actions;
CREATE POLICY client_actions_select ON client_actions FOR SELECT TO authenticated
  USING (
    public.is_site_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = client_actions.project_id
        AND p.team_id = public.current_team_id()
    )
  );

-- No INSERT/UPDATE/DELETE policies → deny by default for authenticated users.
-- Service role (from cron / share actions) bypasses RLS.

-- Done.
