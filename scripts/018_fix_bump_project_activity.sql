-- =====================================================================
-- 018_fix_bump_project_activity.sql
-- NOW() is frozen within a transaction (= transaction_timestamp()), so
-- chained inserts on a project inside one transaction all end up with the
-- same last_activity_at. Use clock_timestamp() so each UPDATE reflects
-- real wall-clock time. Matches the earlier touch_updated_at fix.
-- =====================================================================

CREATE OR REPLACE FUNCTION bump_project_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'milestones' THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  ELSIF TG_TABLE_NAME = 'checklist_items' THEN
    SELECT m.project_id INTO v_project_id
      FROM milestones m
     WHERE m.id = COALESCE(NEW.milestone_id, OLD.milestone_id);
  ELSIF TG_TABLE_NAME = 'files' THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  ELSIF TG_TABLE_NAME = 'comments' THEN
    IF COALESCE(NEW.milestone_id, OLD.milestone_id) IS NOT NULL THEN
      SELECT m.project_id INTO v_project_id
        FROM milestones m
       WHERE m.id = COALESCE(NEW.milestone_id, OLD.milestone_id);
    ELSE
      v_project_id := COALESCE(NEW.project_id, OLD.project_id);
    END IF;
  END IF;

  IF v_project_id IS NOT NULL THEN
    UPDATE projects
       SET last_activity_at = clock_timestamp()
     WHERE id = v_project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
