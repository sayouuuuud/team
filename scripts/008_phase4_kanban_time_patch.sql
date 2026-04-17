-- ============================================================================
-- Phase 4 DB Patch — Kanban workflow + time tracking
-- ============================================================================
-- Additive & idempotent. Targets:
--   * Kanban board performance (status-based grouping)
--   * Assignees lookup by user + by milestone (both directions)
--   * Time tracking aggregations (per user, per project, per day)
--   * Milestone ordering within a project (drag & drop board)
-- ============================================================================

-- Ordering inside a Kanban column ---------------------------------------------
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS board_order INTEGER;

-- When a milestone is finished we want to surface the completion time fast
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Kanban column grouping: (project_id, status, board_order)
CREATE INDEX IF NOT EXISTS idx_milestones_board
  ON milestones (project_id, status, board_order);

-- Assignees: look up "what is assigned to me"
CREATE INDEX IF NOT EXISTS idx_milestone_assignees_user
  ON milestone_assignees (user_id);

-- Reverse lookup "who is on this milestone" (kept explicit even if PK covers it)
CREATE INDEX IF NOT EXISTS idx_milestone_assignees_milestone
  ON milestone_assignees (milestone_id);

-- Time entries: the 3 most common aggregations ---------------------------------
-- (user, day) — user weekly summary
CREATE INDEX IF NOT EXISTS idx_time_entries_user_started
  ON time_entries (user_id, started_at DESC);

-- (project, day) — project time per day / total
CREATE INDEX IF NOT EXISTS idx_time_entries_project_started
  ON time_entries (project_id, started_at DESC);

-- (milestone) — "how long did this milestone take"
CREATE INDEX IF NOT EXISTS idx_time_entries_milestone
  ON time_entries (milestone_id)
  WHERE milestone_id IS NOT NULL;

-- Active (running) timer lookup per user
CREATE INDEX IF NOT EXISTS idx_time_entries_running
  ON time_entries (user_id)
  WHERE ended_at IS NULL;

-- Prevent two running timers for the same user at the same time ----------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_time_entries_one_running_per_user
  ON time_entries (user_id)
  WHERE ended_at IS NULL;

-- Auto-compute duration on close -----------------------------------------------
CREATE OR REPLACE FUNCTION set_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds :=
      GREATEST(0, EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_time_entries_duration ON time_entries;
CREATE TRIGGER trg_time_entries_duration
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION set_time_entry_duration();

-- Auto-stamp approved_at when a milestone transitions to 'approved' ------------
CREATE OR REPLACE FUNCTION stamp_milestone_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved')
     AND NEW.approved_at IS NULL THEN
    NEW.approved_at := NOW();
  END IF;
  -- If we move back out of approved, clear it
  IF TG_OP = 'UPDATE'
     AND NEW.status <> 'approved'
     AND OLD.status = 'approved' THEN
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_milestones_approved_at ON milestones;
CREATE TRIGGER trg_milestones_approved_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION stamp_milestone_approval();
