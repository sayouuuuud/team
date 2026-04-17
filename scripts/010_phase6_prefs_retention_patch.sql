-- =====================================================================
-- Phase 6 DB patch — Profile prefs, file retention, templates, audit
-- =====================================================================
-- Adds:
--   * profiles: timezone, notification prefs, last_seen_at
--   * notifications: priority + delivered_channels
--   * files: deleted_at + deleted_by + retention helpers
--   * milestone_templates: category, is_global, usage_count
--   * audit_log: retention index (fast prune by age)
--   * site_settings: audit_retention_days, file_retention_days,
--     enable_client_share, default_notification_email
--
-- Additive only. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Profile preferences & presence
-- ---------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Cairo',
  ADD COLUMN IF NOT EXISTS notify_email      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_in_app     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_mentions   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_assignments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at      timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON profiles(last_seen_at DESC NULLS LAST)
  WHERE last_seen_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2) Notification enrichment
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS priority notification_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS delivered_channels text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_notifications_priority
  ON notifications(user_id, priority, created_at DESC)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------
-- 3) File retention (soft-delete audit)
-- ---------------------------------------------------------------------
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Keep soft-deleted rows around for audit but make pruning fast
CREATE INDEX IF NOT EXISTS idx_files_deleted_at
  ON files(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- When the existing `is_deleted` flag flips to true, auto-stamp
-- deleted_at if the caller did not set it explicitly.
CREATE OR REPLACE FUNCTION stamp_file_deleted_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());
  ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    NEW.deleted_at := NULL;
    NEW.deleted_by := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_file_deleted_at ON files;
CREATE TRIGGER trg_stamp_file_deleted_at
  BEFORE UPDATE OF is_deleted ON files
  FOR EACH ROW
  EXECUTE FUNCTION stamp_file_deleted_at();

-- ---------------------------------------------------------------------
-- 4) Milestone templates: categorization + global library
-- ---------------------------------------------------------------------
ALTER TABLE milestone_templates
  ADD COLUMN IF NOT EXISTS category    text,
  ADD COLUMN IF NOT EXISTS is_global   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_count int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Global templates (is_global=true) may have team_id IS NULL (site admin),
-- relax the NOT NULL on team_id only if it currently is NOT NULL.
DO $$
DECLARE v_notnull boolean;
BEGIN
  SELECT attnotnull INTO v_notnull
  FROM pg_attribute
  WHERE attrelid = 'milestone_templates'::regclass
    AND attname = 'team_id' AND NOT attisdropped;
  IF v_notnull THEN
    ALTER TABLE milestone_templates ALTER COLUMN team_id DROP NOT NULL;
  END IF;
END $$;

-- Either team_id is set, OR the template is marked global.
ALTER TABLE milestone_templates
  DROP CONSTRAINT IF EXISTS milestone_templates_scope_check;
ALTER TABLE milestone_templates
  ADD CONSTRAINT milestone_templates_scope_check
  CHECK (is_global = true OR team_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_milestone_templates_team
  ON milestone_templates(team_id)
  WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_milestone_templates_global
  ON milestone_templates(category)
  WHERE is_global = true;

-- ---------------------------------------------------------------------
-- 5) Audit log retention index
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_team
  ON audit_log(team_id, created_at DESC)
  WHERE team_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6) Site settings additions
-- ---------------------------------------------------------------------
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS audit_retention_days      int     NOT NULL DEFAULT 365,
  ADD COLUMN IF NOT EXISTS file_retention_days       int     NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS enable_client_share       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_notification_email text;
