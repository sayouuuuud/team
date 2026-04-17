-- =====================================================================
-- 009_phase5_ai_autopilot_patch.sql
-- Phase 5: Smart progress + AI Agent foundation
-- ---------------------------------------------------------------------
-- New columns:
--   projects.auto_status       -- computed by the autopilot (active | at_risk | late | on_track | completed)
--   projects.predicted_end_date
--   projects.last_activity_at  -- used by autopilot and dashboard
--   milestones.auto_status     -- rolling per-milestone health (on_track | at_risk | late | done)
--   milestones.activity_score  -- integer 0..100, refreshed by autopilot
-- ai_usage already has the right columns; we only add a composite index
-- so rate-limit lookups stay O(log n).
-- =====================================================================

-- 1) Enums for the autopilot statuses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_auto_status') THEN
    CREATE TYPE project_auto_status AS ENUM ('on_track', 'at_risk', 'late', 'completed', 'paused');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'milestone_auto_status') THEN
    CREATE TYPE milestone_auto_status AS ENUM ('on_track', 'at_risk', 'late', 'done');
  END IF;
END$$;

-- 2) projects: autopilot columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS auto_status        project_auto_status NOT NULL DEFAULT 'on_track',
  ADD COLUMN IF NOT EXISTS predicted_end_date date,
  ADD COLUMN IF NOT EXISTS last_activity_at   timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_projects_auto_status
  ON projects (team_id, auto_status);

CREATE INDEX IF NOT EXISTS idx_projects_last_activity
  ON projects (team_id, last_activity_at DESC);

-- 3) milestones: autopilot columns
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS auto_status    milestone_auto_status NOT NULL DEFAULT 'on_track',
  ADD COLUMN IF NOT EXISTS activity_score smallint NOT NULL DEFAULT 0
    CHECK (activity_score BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_milestones_auto_status
  ON milestones (project_id, auto_status);

-- 4) ai_usage: rate-limit index (team_id + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_ai_usage_team_time
  ON ai_usage (team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_time
  ON ai_usage (user_id, created_at DESC);

-- 5) Helper function: bump project.last_activity_at whenever a child row
--    in milestones / checklist_items / files / comments changes.
CREATE OR REPLACE FUNCTION bump_project_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'milestones' THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  ELSIF TG_TABLE_NAME = 'checklist_items' THEN
    SELECT project_id INTO v_project_id
      FROM milestones
     WHERE id = COALESCE(NEW.milestone_id, OLD.milestone_id);
  ELSIF TG_TABLE_NAME = 'files' THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  ELSIF TG_TABLE_NAME = 'comments' THEN
    SELECT project_id INTO v_project_id
      FROM milestones
     WHERE id = COALESCE(NEW.milestone_id, OLD.milestone_id);
  END IF;

  IF v_project_id IS NOT NULL THEN
    UPDATE projects
       SET last_activity_at = now()
     WHERE id = v_project_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_activity_milestones    ON milestones;
DROP TRIGGER IF EXISTS trg_bump_activity_checklist     ON checklist_items;
DROP TRIGGER IF EXISTS trg_bump_activity_files         ON files;
DROP TRIGGER IF EXISTS trg_bump_activity_comments      ON comments;

CREATE TRIGGER trg_bump_activity_milestones
AFTER INSERT OR UPDATE OR DELETE ON milestones
FOR EACH ROW EXECUTE FUNCTION bump_project_activity();

CREATE TRIGGER trg_bump_activity_checklist
AFTER INSERT OR UPDATE OR DELETE ON checklist_items
FOR EACH ROW EXECUTE FUNCTION bump_project_activity();

CREATE TRIGGER trg_bump_activity_files
AFTER INSERT OR UPDATE OR DELETE ON files
FOR EACH ROW EXECUTE FUNCTION bump_project_activity();

CREATE TRIGGER trg_bump_activity_comments
AFTER INSERT OR UPDATE OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION bump_project_activity();
