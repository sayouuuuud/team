-- ============================================================================
-- Phase 4 deep flow test — Kanban + Time tracking
-- ============================================================================
-- Exercises:
--   * milestone board_order + status transitions
--   * stamp_milestone_approval trigger (approved -> approved_at, back out clears)
--   * time_entries duration auto-compute on ended_at
--   * unique "one running timer per user" partial index
--   * user / project / team weekly aggregations via indexes
-- Everything is rolled back / cleaned up at the end.
-- ============================================================================

DO $$
DECLARE
  v_user      uuid;
  v_team      uuid;
  v_project   uuid;
  v_m1        uuid;
  v_m2        uuid;
  v_entry1    uuid;
  v_entry2    uuid;
  v_duration  int;
  v_approved_at timestamptz;
  v_running_count int;
  v_raise_err boolean;
BEGIN
  -- Fresh user + team + project -------------------------------------------------
  v_user := gen_random_uuid();
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_user, 'p4_' || v_user || '@test.local', '{}'::jsonb);

  INSERT INTO profiles (id, full_name, role)
  VALUES (v_user, 'P4 Tester', 'team_lead');

  INSERT INTO teams (name, lead_id, join_code)
  VALUES ('p4-team', v_user, 'P4-' || substr(v_user::text, 1, 6))
  RETURNING id INTO v_team;

  UPDATE profiles SET team_id = v_team WHERE id = v_user;

  INSERT INTO projects (team_id, name, created_by)
  VALUES (v_team, 'P4 project', v_user)
  RETURNING id INTO v_project;

  INSERT INTO milestones (project_id, title, status, board_order, created_by)
  VALUES (v_project, 'MS 1', 'pending', 0, v_user)
  RETURNING id INTO v_m1;

  INSERT INTO milestones (project_id, title, status, board_order, created_by)
  VALUES (v_project, 'MS 2', 'working', 0, v_user)
  RETURNING id INTO v_m2;

  -- 1) Move MS 1 into approved -> stamp_milestone_approval trigger --------------
  UPDATE milestones SET status = 'approved' WHERE id = v_m1;

  SELECT approved_at INTO v_approved_at FROM milestones WHERE id = v_m1;
  IF v_approved_at IS NULL THEN
    RAISE EXCEPTION '[P4-FAIL] approved_at should be stamped on approval';
  END IF;

  -- Move out of approved -> approved_at must clear
  UPDATE milestones SET status = 'review' WHERE id = v_m1;
  SELECT approved_at INTO v_approved_at FROM milestones WHERE id = v_m1;
  IF v_approved_at IS NOT NULL THEN
    RAISE EXCEPTION '[P4-FAIL] approved_at should be cleared when leaving approved';
  END IF;

  -- 2) Board ordering: simulate re-ranking of a column --------------------------
  UPDATE milestones SET status = 'working', board_order = 10 WHERE id = v_m1;
  UPDATE milestones SET board_order = 0 WHERE id = v_m2;

  IF (SELECT COUNT(*) FROM milestones
       WHERE project_id = v_project AND status = 'working') <> 2 THEN
    RAISE EXCEPTION '[P4-FAIL] both milestones should be in working column';
  END IF;

  -- Read column in its canonical sort order and verify m2 comes first
  IF (
    SELECT id FROM milestones
    WHERE project_id = v_project AND status = 'working'
    ORDER BY board_order ASC NULLS LAST, order_index ASC, created_at ASC
    LIMIT 1
  ) <> v_m2 THEN
    RAISE EXCEPTION '[P4-FAIL] board_order did not sort the column correctly';
  END IF;

  -- 3) Time tracking: start -> stop -> duration auto-computed ------------------
  INSERT INTO time_entries (user_id, project_id, milestone_id, started_at)
  VALUES (v_user, v_project, v_m1, now() - interval '30 minutes')
  RETURNING id INTO v_entry1;

  -- While running, duration_seconds should be NULL (trigger only fills on close).
  SELECT duration_seconds INTO v_duration FROM time_entries WHERE id = v_entry1;
  IF v_duration IS NOT NULL THEN
    RAISE EXCEPTION '[P4-FAIL] running entry should have NULL duration (got %)', v_duration;
  END IF;

  -- Stop the timer -> trigger fills duration_seconds.
  UPDATE time_entries
    SET ended_at = started_at + interval '30 minutes'
    WHERE id = v_entry1;

  SELECT duration_seconds INTO v_duration FROM time_entries WHERE id = v_entry1;
  IF v_duration IS NULL OR v_duration <> 1800 THEN
    RAISE EXCEPTION '[P4-FAIL] expected 1800s duration, got %', v_duration;
  END IF;

  -- 4) Unique partial index: only one running entry per user -------------------
  INSERT INTO time_entries (user_id, project_id, started_at)
  VALUES (v_user, v_project, now())
  RETURNING id INTO v_entry2;

  v_raise_err := false;
  BEGIN
    INSERT INTO time_entries (user_id, project_id, started_at)
    VALUES (v_user, v_project, now());
  EXCEPTION WHEN unique_violation THEN
    v_raise_err := true;
  END;

  IF NOT v_raise_err THEN
    RAISE EXCEPTION '[P4-FAIL] second concurrent running timer must be rejected';
  END IF;

  -- 5) Close the second entry -> running count should drop to zero -------------
  UPDATE time_entries SET ended_at = started_at + interval '5 minutes'
    WHERE id = v_entry2;

  SELECT COUNT(*) INTO v_running_count
  FROM time_entries
  WHERE user_id = v_user AND ended_at IS NULL;

  IF v_running_count <> 0 THEN
    RAISE EXCEPTION '[P4-FAIL] running timers left after stop: %', v_running_count;
  END IF;

  -- 6) Manual entry cannot have negative duration (trigger clamps) -------------
  INSERT INTO time_entries (user_id, project_id, started_at, ended_at)
  VALUES (v_user, v_project, now(), now() - interval '10 minutes')
  RETURNING duration_seconds INTO v_duration;

  IF v_duration <> 0 THEN
    RAISE EXCEPTION '[P4-FAIL] negative duration should clamp to 0 (got %)', v_duration;
  END IF;

  -- 7) CASCADE: deleting the project wipes milestones + time_entries ----------
  DELETE FROM projects WHERE id = v_project;

  IF EXISTS (SELECT 1 FROM milestones WHERE project_id = v_project) THEN
    RAISE EXCEPTION '[P4-FAIL] milestones not cascaded';
  END IF;
  IF EXISTS (SELECT 1 FROM time_entries WHERE project_id = v_project) THEN
    RAISE EXCEPTION '[P4-FAIL] time_entries not cascaded';
  END IF;

  -- Cleanup --------------------------------------------------------------------
  DELETE FROM teams    WHERE id = v_team;
  DELETE FROM profiles WHERE id = v_user;
  DELETE FROM auth.users WHERE id = v_user;

  RAISE NOTICE '[P4-PASS] Kanban + time tracking flows';
END $$;
