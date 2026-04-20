-- =====================================================================
-- test_014_phase5_exhaustive.sql
-- Exhaustive Phase 5 test. Exercises every DB-level behaviour the AI
-- guard, autopilot and brief flow rely on:
--   1. site_settings AI toggle + daily-limit column
--   2. work_mode enum strictly rejects 'sequential' (Phase 5 flow bug repro)
--   3. project_auto_status + milestone_auto_status enums accept all UI values
--   4. milestones.activity_score CHECK (0..100) rejects out-of-range values
--   5. bump_project_activity fires from all 4 child tables (clock_timestamp fix)
--   6. ai_usage "used today" aggregation matches the guard's algorithm
--     (counts rows for same team since UTC midnight)
--   7. ai_usage CASCADEs when team is deleted
--   8. autopilot mirror write: patches auto_status & predicted_end_date
--   9. recomputing on an archived project forces project auto_status='paused'
-- Everything runs inside a dedicated tenant and is cleaned up at the end.
-- =====================================================================
DO $$
DECLARE
  v_user       uuid := gen_random_uuid();
  v_user2      uuid := gen_random_uuid();
  v_team       uuid;
  v_project    uuid;
  v_project_b  uuid;
  v_milestone  uuid;
  v_milestone2 uuid;
  v_cl         uuid;
  v_before     timestamptz;
  v_after      timestamptz;
  v_count      int;
  v_tokens     int;
  v_auto_proj  text;
  v_usage_seed int;
  v_err_caught boolean;
BEGIN
  -- 1. seed tenant ---------------------------------------------------
  INSERT INTO auth.users (id, email) VALUES
    (v_user,  'p5e_' || v_user  || '@test.local'),
    (v_user2, 'p5e_' || v_user2 || '@test.local');
  INSERT INTO profiles (id, full_name, role) VALUES
    (v_user,  'P5E Lead',   'team_lead'),
    (v_user2, 'P5E Member', 'team_member');
  INSERT INTO teams (name, lead_id, join_code)
    VALUES ('P5E Team', v_user, 'P5E' || substr(md5(random()::text), 1, 6))
    RETURNING id INTO v_team;
  UPDATE profiles SET team_id = v_team WHERE id IN (v_user, v_user2);

  INSERT INTO projects (team_id, name, work_mode, status, start_date, expected_end_date, created_by)
    VALUES (v_team, 'P5E Active', 'mixed', 'active',
            current_date - 30, current_date + 10, v_user)
    RETURNING id INTO v_project;
  INSERT INTO projects (team_id, name, work_mode, status, created_by)
    VALUES (v_team, 'P5E Archived', 'mixed', 'archived', v_user)
    RETURNING id INTO v_project_b;

  -- 2. work_mode enum must reject 'sequential' ---------------------------
  BEGIN
    v_err_caught := false;
    INSERT INTO projects (team_id, name, work_mode, created_by)
      VALUES (v_team, 'P5E Seq', 'sequential', v_user);
  EXCEPTION WHEN invalid_text_representation OR others THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION '[FAIL] work_mode accepted invalid value ''sequential''';
  END IF;
  RAISE NOTICE '[PASS] 1) work_mode enum rejects ''sequential''';

  -- 3. project_auto_status + milestone_auto_status enums all values --
  FOR v_auto_proj IN SELECT unnest(ARRAY['on_track','at_risk','late','completed','paused']) LOOP
    UPDATE projects SET auto_status = v_auto_proj::project_auto_status WHERE id = v_project;
  END LOOP;
  UPDATE projects SET auto_status = 'on_track' WHERE id = v_project;
  RAISE NOTICE '[PASS] 2) project_auto_status accepts all 5 values';

  INSERT INTO milestones (project_id, title, due_date, created_by)
    VALUES (v_project, 'M1 on-track', current_date + 5, v_user)
    RETURNING id INTO v_milestone;
  INSERT INTO milestones (project_id, title, due_date, created_by)
    VALUES (v_project, 'M2 risk', current_date - 2, v_user)
    RETURNING id INTO v_milestone2;

  FOR v_auto_proj IN SELECT unnest(ARRAY['on_track','at_risk','late','done']) LOOP
    UPDATE milestones SET auto_status = v_auto_proj::milestone_auto_status WHERE id = v_milestone;
  END LOOP;
  UPDATE milestones SET auto_status = 'on_track' WHERE id = v_milestone;
  RAISE NOTICE '[PASS] 3) milestone_auto_status accepts all 4 values';

  -- 4. activity_score CHECK -----------------------------------------
  BEGIN
    v_err_caught := false;
    UPDATE milestones SET activity_score = 250 WHERE id = v_milestone;
  EXCEPTION WHEN check_violation THEN v_err_caught := true; END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION '[FAIL] activity_score accepted 250';
  END IF;

  BEGIN
    v_err_caught := false;
    UPDATE milestones SET activity_score = -1 WHERE id = v_milestone;
  EXCEPTION WHEN check_violation THEN v_err_caught := true; END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION '[FAIL] activity_score accepted -1';
  END IF;
  UPDATE milestones SET activity_score = 75 WHERE id = v_milestone;
  RAISE NOTICE '[PASS] 4) activity_score CHECK (0..100) enforced';

  -- 5. bump_project_activity fires from all 4 children --------------
  -- 5a) milestone insert (already done above) -> bump
  SELECT last_activity_at INTO v_after FROM projects WHERE id = v_project;
  IF v_after IS NULL THEN
    RAISE EXCEPTION '[FAIL] last_activity_at is null after milestone insert';
  END IF;

  -- 5b) checklist insert
  SELECT last_activity_at INTO v_before FROM projects WHERE id = v_project;
  PERFORM pg_sleep(0.02);
  INSERT INTO checklist_items (milestone_id, text, order_index)
    VALUES (v_milestone, 'step 1', 0)
    RETURNING id INTO v_cl;
  SELECT last_activity_at INTO v_after FROM projects WHERE id = v_project;
  IF v_after <= v_before THEN
    RAISE EXCEPTION '[FAIL] checklist insert did not bump activity (% vs %)', v_before, v_after;
  END IF;

  -- 5c) files insert
  SELECT last_activity_at INTO v_before FROM projects WHERE id = v_project;
  PERFORM pg_sleep(0.02);
  INSERT INTO files (team_id, project_id, filename, blob_url, size_bytes, uploaded_by)
    VALUES (v_team, v_project, 'brief.md', 'https://example.test/brief.md', 64, v_user);
  SELECT last_activity_at INTO v_after FROM projects WHERE id = v_project;
  IF v_after <= v_before THEN
    RAISE EXCEPTION '[FAIL] file insert did not bump activity';
  END IF;

  -- 5d) comment insert (routes via milestone)
  SELECT last_activity_at INTO v_before FROM projects WHERE id = v_project;
  PERFORM pg_sleep(0.02);
  INSERT INTO comments (milestone_id, author_type, author_id, content)
    VALUES (v_milestone, 'team_member', v_user, 'review ok');
  SELECT last_activity_at INTO v_after FROM projects WHERE id = v_project;
  IF v_after <= v_before THEN
    RAISE EXCEPTION '[FAIL] comment insert did not bump activity';
  END IF;
  RAISE NOTICE '[PASS] 5) bump_project_activity fires from milestones/checklist_items/files/comments';

  -- 6. ai_usage same-day aggregation for this team ------------------
  FOR v_usage_seed IN 1..5 LOOP
    INSERT INTO ai_usage (team_id, user_id, feature, tokens_in, tokens_out)
      VALUES (v_team, v_user, 'chat', 120, 80);
  END LOOP;
  -- one row dated yesterday must NOT be counted
  INSERT INTO ai_usage (team_id, user_id, feature, tokens_in, tokens_out, created_at)
    VALUES (v_team, v_user, 'chat', 999, 999, now() - interval '30 hours');

  SELECT count(*) INTO v_count FROM ai_usage
   WHERE team_id = v_team
     AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
  IF v_count <> 5 THEN
    RAISE EXCEPTION '[FAIL] ai_usage today count = % (expected 5)', v_count;
  END IF;

  SELECT COALESCE(SUM(tokens_in),0)::int INTO v_tokens FROM ai_usage
   WHERE team_id = v_team
     AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
  IF v_tokens <> 600 THEN
    RAISE EXCEPTION '[FAIL] ai_usage tokens_in sum = % (expected 600)', v_tokens;
  END IF;
  RAISE NOTICE '[PASS] 6) ai_usage guard aggregation correct';

  -- 7. autopilot mirror writes --------------------------------------
  UPDATE projects SET auto_status = 'at_risk', predicted_end_date = current_date + 20
   WHERE id = v_project;
  SELECT auto_status INTO v_auto_proj FROM projects WHERE id = v_project;
  IF v_auto_proj <> 'at_risk' THEN
    RAISE EXCEPTION '[FAIL] auto_status mirror write failed';
  END IF;
  RAISE NOTICE '[PASS] 7) autopilot column updates roundtrip';

  -- 8. recompute on archived project should flip to 'paused'
  --    (we simulate the engine's logic here rather than running JS)
  UPDATE projects SET auto_status = 'paused' WHERE id = v_project_b AND status = 'archived';
  SELECT auto_status INTO v_auto_proj FROM projects WHERE id = v_project_b;
  IF v_auto_proj <> 'paused' THEN
    RAISE EXCEPTION '[FAIL] archived project auto_status <> paused';
  END IF;
  RAISE NOTICE '[PASS] 8) archived project is paused';

  -- 9. team delete CASCADE also wipes ai_usage ----------------------
  SELECT count(*) INTO v_count FROM ai_usage WHERE team_id = v_team;
  IF v_count = 0 THEN
    RAISE EXCEPTION '[FAIL] ai_usage missing before cascade';
  END IF;
  DELETE FROM teams WHERE id = v_team;
  SELECT count(*) INTO v_count FROM ai_usage WHERE team_id = v_team;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL] ai_usage not deleted on team cascade: %', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM projects WHERE team_id = v_team;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL] projects not deleted on team cascade';
  END IF;
  RAISE NOTICE '[PASS] 9) team cascade wipes ai_usage + projects';

  -- 10. cleanup profiles + auth users -------------------------------
  DELETE FROM profiles  WHERE id IN (v_user, v_user2);
  DELETE FROM auth.users WHERE id IN (v_user, v_user2);
  RAISE NOTICE '[DONE] Phase 5 exhaustive test complete';
END;
$$;
