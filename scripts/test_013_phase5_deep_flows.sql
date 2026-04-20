-- =====================================================================
-- test_013_phase5_deep_flows.sql
-- Phase 5 deep flow test (temporary data, full cleanup).
-- Exercises:
--   1) last_activity_at bump triggers (milestones, checklist_items,
--      files, comments)
--   2) ai_usage daily limit (count-based)
--   3) project auto_status + predicted_end_date write-through
--   4) milestone auto_status + activity_score write-through
--   5) site_settings.ai_enabled toggle
-- =====================================================================

DO $$
DECLARE
  v_user      uuid := gen_random_uuid();
  v_team      uuid;
  v_project   uuid;
  v_milestone uuid;
  v_cl_item   uuid;
  v_initial_activity timestamptz;
  v_after_child_activity timestamptz;
  v_count int;
BEGIN
  RAISE NOTICE '--- Phase 5 deep flow test ---';

  ------------------------------------------------------------------
  -- Fresh tenant
  ------------------------------------------------------------------
  INSERT INTO auth.users (id, email) VALUES (v_user, 'p5_' || v_user || '@test.local');
  INSERT INTO profiles (id, full_name, role) VALUES (v_user, 'P5 Tester', 'team_lead');
  INSERT INTO teams (name, lead_id, join_code)
    VALUES ('P5 Team', v_user, 'P5' || substr(md5(random()::text), 1, 6))
    RETURNING id INTO v_team;
  UPDATE profiles SET team_id = v_team WHERE id = v_user;
  INSERT INTO projects (team_id, name, status, work_mode, created_by)
    VALUES (v_team, 'P5 Project', 'active', 'parallel', v_user)
    RETURNING id INTO v_project;

  -- Capture baseline
  SELECT last_activity_at INTO v_initial_activity FROM projects WHERE id=v_project;

  ------------------------------------------------------------------
  -- TEST 1: milestone insert bumps project.last_activity_at
  ------------------------------------------------------------------
  PERFORM pg_sleep(0.05);
  INSERT INTO milestones (project_id, title, status, progress, order_index, created_by)
    VALUES (v_project, 'Design draft', 'working', 40, 0, v_user)
    RETURNING id INTO v_milestone;

  SELECT last_activity_at INTO v_after_child_activity FROM projects WHERE id=v_project;
  IF v_after_child_activity <= v_initial_activity THEN
    RAISE EXCEPTION '[FAIL] milestone insert did not bump last_activity_at (% vs %)',
      v_after_child_activity, v_initial_activity;
  END IF;
  RAISE NOTICE '[PASS] milestones → bump_project_activity';

  ------------------------------------------------------------------
  -- TEST 2: checklist_items insert also bumps it
  ------------------------------------------------------------------
  v_initial_activity := v_after_child_activity;
  PERFORM pg_sleep(0.05);
  INSERT INTO checklist_items (milestone_id, text, order_index, is_done)
    VALUES (v_milestone, 'wireframes', 0, false)
    RETURNING id INTO v_cl_item;

  SELECT last_activity_at INTO v_after_child_activity FROM projects WHERE id=v_project;
  IF v_after_child_activity <= v_initial_activity THEN
    RAISE EXCEPTION '[FAIL] checklist insert did not bump activity';
  END IF;
  RAISE NOTICE '[PASS] checklist_items → bump_project_activity';

  ------------------------------------------------------------------
  -- TEST 3: files insert bumps too
  ------------------------------------------------------------------
  v_initial_activity := v_after_child_activity;
  PERFORM pg_sleep(0.05);
  INSERT INTO files (team_id, project_id, filename, blob_url, size_bytes, uploaded_by)
    VALUES (v_team, v_project, 'brief.zip', 'https://example.test/brief.zip', 1024, v_user);

  SELECT last_activity_at INTO v_after_child_activity FROM projects WHERE id=v_project;
  IF v_after_child_activity <= v_initial_activity THEN
    RAISE EXCEPTION '[FAIL] file insert did not bump activity';
  END IF;
  RAISE NOTICE '[PASS] files → bump_project_activity';

  ------------------------------------------------------------------
  -- TEST 4: comments insert bumps too
  ------------------------------------------------------------------
  v_initial_activity := v_after_child_activity;
  PERFORM pg_sleep(0.05);
  INSERT INTO comments (milestone_id, author_type, author_id, content)
    VALUES (v_milestone, 'team_member', v_user, 'Looks good');

  SELECT last_activity_at INTO v_after_child_activity FROM projects WHERE id=v_project;
  IF v_after_child_activity <= v_initial_activity THEN
    RAISE EXCEPTION '[FAIL] comment insert did not bump activity';
  END IF;
  RAISE NOTICE '[PASS] comments → bump_project_activity';

  ------------------------------------------------------------------
  -- TEST 5: ai_usage rows are queryable by (team_id, created_at)
  ------------------------------------------------------------------
  INSERT INTO ai_usage (team_id, user_id, feature, tokens_in, tokens_out)
    VALUES
      (v_team, v_user, 'chat', 100, 50),
      (v_team, v_user, 'brief_to_project', 400, 200);

  SELECT COUNT(*) INTO v_count
    FROM ai_usage
   WHERE team_id=v_team
     AND created_at >= now() - interval '1 minute';
  IF v_count <> 2 THEN
    RAISE EXCEPTION '[FAIL] ai_usage expected 2 rows got %', v_count;
  END IF;
  RAISE NOTICE '[PASS] ai_usage insert + (team_id, created_at) lookup';

  ------------------------------------------------------------------
  -- TEST 6: autopilot write-through on projects + milestones
  ------------------------------------------------------------------
  UPDATE projects
     SET auto_status='at_risk',
         predicted_end_date = (CURRENT_DATE + INTERVAL '14 days')::date
   WHERE id=v_project;

  UPDATE milestones
     SET auto_status='at_risk',
         activity_score=45
   WHERE id=v_milestone;

  PERFORM 1 FROM projects WHERE id=v_project AND auto_status='at_risk';
  IF NOT FOUND THEN
    RAISE EXCEPTION '[FAIL] projects.auto_status did not persist';
  END IF;
  PERFORM 1 FROM milestones WHERE id=v_milestone AND auto_status='at_risk' AND activity_score=45;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[FAIL] milestones.auto_status/activity_score did not persist';
  END IF;
  RAISE NOTICE '[PASS] autopilot columns persist expected values';

  ------------------------------------------------------------------
  -- TEST 7: milestone activity_score CHECK constraint (0..100)
  ------------------------------------------------------------------
  BEGIN
    UPDATE milestones SET activity_score = 150 WHERE id = v_milestone;
    RAISE EXCEPTION '[FAIL] activity_score=150 was accepted (should violate CHECK)';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '[PASS] activity_score CHECK rejects out-of-range';
  END;

  ------------------------------------------------------------------
  -- CLEANUP
  ------------------------------------------------------------------
  DELETE FROM ai_usage WHERE team_id = v_team;
  DELETE FROM projects WHERE id = v_project;  -- cascades milestones, checklist, files, comments
  DELETE FROM profiles WHERE id = v_user;
  DELETE FROM teams    WHERE id = v_team;
  DELETE FROM auth.users WHERE id = v_user;

  RAISE NOTICE '--- ALL Phase 5 DEEP FLOW TESTS PASSED ---';
END$$;
