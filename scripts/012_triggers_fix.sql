-- ======================================================================
-- 012_triggers_fix.sql
-- Fix sync_milestone_progress() to use the real column name `progress`
-- (not `progress_percent` which does not exist on milestones).
-- ======================================================================

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
    SET progress = CASE WHEN v_total = 0 THEN 0
                        ELSE ROUND((v_done::numeric / v_total) * 100)::int
                   END,
        updated_at = NOW()
    WHERE id = v_milestone_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
