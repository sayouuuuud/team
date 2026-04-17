-- ─────────────────────────────────────────────────────────────
-- Phase 1 — Patch: add missing site_settings columns used by
-- the admin UI and signup gate (signups_open, default_team_capacity).
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS signups_open          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_team_capacity int     NOT NULL DEFAULT 8;

-- Make sure the singleton row has sane values for the new columns.
UPDATE site_settings
   SET signups_open          = COALESCE(signups_open, true),
       default_team_capacity = COALESCE(default_team_capacity, 8)
 WHERE id = 1;
