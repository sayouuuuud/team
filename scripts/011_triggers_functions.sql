-- =========================================================================
-- 011_triggers_functions.sql
-- Cross-cutting triggers, functions, and maintenance routines that sit on
-- top of Phases 1-6. Everything here is idempotent and safe to re-run.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) touch_updated_at trigger (generic)
--    Attaches to any table that has an updated_at column.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.%I;', t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_touch_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t
    );
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- 2) sync_milestone_progress()
--    Keeps milestones.progress_percent in sync with its checklist_items.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_milestone_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_milestone_id UUID;
  v_total INT;
  v_done INT;
BEGIN
  v_milestone_id := COALESCE(NEW.milestone_id, OLD.milestone_id);

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_done)
    INTO v_total, v_done
  FROM checklist_items
  WHERE milestone_id = v_milestone_id;

  UPDATE milestones
    SET progress_percent = CASE WHEN v_total = 0 THEN 0
                                ELSE ROUND((v_done::numeric / v_total) * 100)
                           END,
        updated_at = NOW()
    WHERE id = v_milestone_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_milestone_progress ON checklist_items;
CREATE TRIGGER trg_sync_milestone_progress
  AFTER INSERT OR UPDATE OF is_done OR DELETE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_milestone_progress();

-- -------------------------------------------------------------------------
-- 3) recompute_project_auto_status()
--    Walks milestones to derive projects.auto_status + predicted_end_date.
--    Called manually from server code (once per project on write).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_project_auto_status(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total INT;
  v_done  INT;
  v_pct   INT;
  v_last  TIMESTAMPTZ;
  v_status project_auto_status;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'approved'),
         MAX(updated_at)
    INTO v_total, v_done, v_last
  FROM milestones
  WHERE project_id = p_project_id;

  v_pct := CASE WHEN v_total = 0 THEN 0
                ELSE ROUND((v_done::numeric / v_total) * 100) END;

  -- Status derivation (simple heuristic; AI layer can override later)
  IF v_total = 0 THEN
    v_status := 'idle';
  ELSIF v_done = v_total THEN
    v_status := 'complete';
  ELSIF v_last IS NOT NULL AND v_last < NOW() - INTERVAL '7 days' THEN
    v_status := 'stalled';
  ELSIF EXISTS (
    SELECT 1 FROM milestones
    WHERE project_id = p_project_id
      AND due_date IS NOT NULL
      AND due_date < NOW()
      AND status <> 'approved'
  ) THEN
    v_status := 'at_risk';
  ELSE
    v_status := 'on_track';
  END IF;

  UPDATE projects
     SET auto_status = v_status,
         last_activity_at = GREATEST(COALESCE(last_activity_at, '-infinity'::timestamptz), COALESCE(v_last, last_activity_at)),
         updated_at = NOW()
   WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 4) prune_soft_deleted_files()
--    Hard-deletes files soft-deleted > site_settings.file_retention_days ago.
--    Intended to be called by a cron/worker (NOT an auto trigger).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_soft_deleted_files()
RETURNS INT AS $$
DECLARE
  v_days INT;
  v_count INT;
BEGIN
  SELECT file_retention_days INTO v_days FROM site_settings WHERE id = 1;
  IF v_days IS NULL OR v_days <= 0 THEN RETURN 0; END IF;

  WITH del AS (
    DELETE FROM files
     WHERE deleted_at IS NOT NULL
       AND deleted_at < NOW() - make_interval(days => v_days)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM del;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 5) prune_audit_log()
--    Trims audit_log beyond site_settings.audit_retention_days.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_audit_log()
RETURNS INT AS $$
DECLARE
  v_days INT;
  v_count INT;
BEGIN
  SELECT audit_retention_days INTO v_days FROM site_settings WHERE id = 1;
  IF v_days IS NULL OR v_days <= 0 THEN RETURN 0; END IF;

  WITH del AS (
    DELETE FROM audit_log
     WHERE created_at < NOW() - make_interval(days => v_days)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM del;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 6) prune_expired_invitations() + expire_old_share_tokens()
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_expired_invitations()
RETURNS INT AS $$
DECLARE v_count INT;
BEGIN
  WITH del AS (
    DELETE FROM team_invitations
     WHERE accepted_at IS NULL
       AND expires_at IS NOT NULL
       AND expires_at < NOW() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 7) Safety: prevent self-lead removal
--    A Lead cannot demote themselves while they are the team's lead_id.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_lead_demotion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'team_lead' AND NEW.role <> 'team_lead' THEN
    IF EXISTS (SELECT 1 FROM teams WHERE lead_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot demote the active team lead. Transfer leadership first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_lead_demotion ON profiles;
CREATE TRIGGER trg_prevent_lead_demotion
  BEFORE UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_lead_demotion();
