-- =============================================================================
-- Phase 4 Exhaustive Test — Kanban + Time Tracking
-- =============================================================================
-- Exercises every server-side invariant that the UI (KanbanBoard, TimerWidget,
-- TimePanel, MyTasks) depends on. Runs on a fresh temp tenant, asserts, then
-- cleans up (auth.users + profile + team). Nothing persists.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_lead      uuid := gen_random_uuid();
  v_member    uuid := gen_random_uuid();
  v_other     uuid := gen_random_uuid();  -- a second user, for running-timer-per-user
  v_team      uuid;
  v_project   uuid;
  v_m1        uuid;
  v_m2        uuid;
  v_m3        uuid;
  v_te1       uuid;
  v_te2       uuid;
  v_te3       uuid;
  v_approved  timestamptz;
  v_approved2 timestamptz;
  v_dur       int;
  v_count     int;
  v_exists    boolean;
  v_nextrank  int;
BEGIN
  -- ---------- Tenant setup -----------------------------------------------------
  INSERT INTO auth.users (id, email) VALUES
    (v_lead,   'p4e_lead_'   || v_lead   || '@test.local'),
    (v_member, 'p4e_member_' || v_member || '@test.local'),
    (v_other,  'p4e_other_'  || v_other  || '@test.local');

  INSERT INTO profiles (id, full_name, role) VALUES
    (v_lead,   'P4E Lead',   'team_lead'),
    (v_member, 'P4E Member', 'member'),
    (v_other,  'P4E Other',  'member');

  INSERT INTO teams (name, lead_id, join_code)
    VALUES ('P4E Team', v_lead,
            'P4E' || substr(md5(random()::text), 1, 6))
    RETURNING id INTO v_team;

  UPDATE profiles SET team_id = v_team WHERE id IN (v_lead, v_member, v_other);

  INSERT INTO projects (team_id, name, status)
    VALUES (v_team, 'P4E Project', 'active')
    RETURNING id INTO v_project;

  RAISE NOTICE '[P4E-SETUP] team=%, project=%', v_team, v_project;

  -- ---------- 1) milestone_status enum accepts every UI value ------------------
  INSERT INTO milestones (project_id, title, status, board_order)
    VALUES (v_project, 'M-pending',  'pending',  10)
    RETURNING id INTO v_m1;
  INSERT INTO milestones (project_id, title, status, board_order)
    VALUES (v_project, 'M-working',  'working',  20)
    RETURNING id INTO v_m2;
  INSERT INTO milestones (project_id, title, status, board_order)
    VALUES (v_project, 'M-review',   'review',   30)
    RETURNING id INTO v_m3;
  INSERT INTO milestones (project_id, title, status, board_order)
    VALUES (v_project, 'M-rejected', 'rejected', 40);
  -- 'approved' tested via transition below
  RAISE NOTICE '[P4E-OK  1] milestone_status enum accepts every UI value';

  -- ---------- 2) milestones.progress CHECK (0..100) ---------------------------
  BEGIN
    INSERT INTO milestones (project_id, title, progress)
      VALUES (v_project, 'M-bad-low',  -1);
    RAISE EXCEPTION '[P4E-FAIL 2a] progress=-1 was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO milestones (project_id, title, progress)
      VALUES (v_project, 'M-bad-high', 101);
    RAISE EXCEPTION '[P4E-FAIL 2b] progress=101 was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  -- Boundary values must pass
  INSERT INTO milestones (project_id, title, progress) VALUES (v_project, 'M-p0',   0);
  INSERT INTO milestones (project_id, title, progress) VALUES (v_project, 'M-p100', 100);
  RAISE NOTICE '[P4E-OK  2] progress CHECK enforces 0..100';

  -- ---------- 3) stamp_milestone_approval: sets approved_at on → approved ------
  -- We intentionally interleave clock_timestamp to differ from NOW().
  PERFORM pg_sleep(0.01);
  UPDATE milestones SET status = 'approved' WHERE id = v_m1;
  SELECT approved_at INTO v_approved FROM milestones WHERE id = v_m1;
  IF v_approved IS NULL THEN
    RAISE EXCEPTION '[P4E-FAIL 3a] approved_at was NOT stamped on transition to approved';
  END IF;
  RAISE NOTICE '[P4E-OK  3a] approved_at stamped on → approved  (%)', v_approved;

  -- ---------- 4) stamp_milestone_approval: idempotent on same-status update ----
  PERFORM pg_sleep(0.01);
  UPDATE milestones SET title = 'M-still-approved' WHERE id = v_m1;
  SELECT approved_at INTO v_approved2 FROM milestones WHERE id = v_m1;
  IF v_approved2 IS DISTINCT FROM v_approved THEN
    RAISE EXCEPTION '[P4E-FAIL 4]  approved_at was re-stamped on same-status update (% → %)',
      v_approved, v_approved2;
  END IF;
  RAISE NOTICE '[P4E-OK  4 ] approved_at is preserved across non-status updates';

  -- ---------- 5) stamp_milestone_approval: clears approved_at on leaving -------
  UPDATE milestones SET status = 'working' WHERE id = v_m1;
  SELECT approved_at INTO v_approved FROM milestones WHERE id = v_m1;
  IF v_approved IS NOT NULL THEN
    RAISE EXCEPTION '[P4E-FAIL 5]  approved_at was NOT cleared on leaving approved';
  END IF;
  RAISE NOTICE '[P4E-OK  5 ] approved_at cleared on leaving approved';

  -- ---------- 6) board_order ordering within a column -------------------------
  -- Reset: give m1/m2/m3 explicit ordering and check the board data helper's
  -- sort (board_order ASC NULLS LAST, order_index ASC, created_at ASC).
  UPDATE milestones SET status = 'working', board_order = 300 WHERE id = v_m1;
  UPDATE milestones SET                      board_order = 100 WHERE id = v_m2;
  UPDATE milestones SET status = 'working', board_order = 200 WHERE id = v_m3;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY board_order NULLS LAST, order_index, created_at) rn
    FROM milestones
    WHERE project_id = v_project AND status = 'working'
  ) t
  WHERE (id = v_m2 AND rn = 1)
     OR (id = v_m3 AND rn = 2)
     OR (id = v_m1 AND rn = 3);

  IF v_count < 3 THEN
    RAISE EXCEPTION '[P4E-FAIL 6]  board_order sort wrong (expected m2,m3,m1; got % rows matching)', v_count;
  END IF;
  RAISE NOTICE '[P4E-OK  6 ] board_order sort deterministic';

  -- ---------- 7) set_time_entry_duration on INSERT with ended_at --------------
  INSERT INTO time_entries (user_id, project_id, milestone_id, started_at, ended_at)
    VALUES (v_member, v_project, v_m2,
            '2026-04-01 10:00:00+00',
            '2026-04-01 11:30:00+00')
    RETURNING id, duration_seconds INTO v_te1, v_dur;
  IF v_dur <> 5400 THEN
    RAISE EXCEPTION '[P4E-FAIL 7a] duration_seconds wrong on INSERT (got %, expected 5400)', v_dur;
  END IF;
  RAISE NOTICE '[P4E-OK  7a] INSERT trigger computed 1.5h → 5400s';

  -- ---------- 8) set_time_entry_duration on UPDATE (stop later) ---------------
  -- Create a running timer, then stop it — duration should fill in.
  INSERT INTO time_entries (user_id, project_id, started_at)
    VALUES (v_member, v_project, '2026-04-02 09:00:00+00')
    RETURNING id INTO v_te2;
  SELECT duration_seconds INTO v_dur FROM time_entries WHERE id = v_te2;
  IF v_dur IS NOT NULL THEN
    RAISE EXCEPTION '[P4E-FAIL 8a] running entry has non-null duration (%)', v_dur;
  END IF;
  UPDATE time_entries SET ended_at = '2026-04-02 09:45:00+00' WHERE id = v_te2;
  SELECT duration_seconds INTO v_dur FROM time_entries WHERE id = v_te2;
  IF v_dur <> 2700 THEN
    RAISE EXCEPTION '[P4E-FAIL 8b] duration_seconds wrong on UPDATE (got %, expected 2700)', v_dur;
  END IF;
  RAISE NOTICE '[P4E-OK  8 ] UPDATE trigger filled duration when ended_at was set';

  -- ---------- 9) set_time_entry_duration clamps negative to 0 -----------------
  INSERT INTO time_entries (user_id, project_id, started_at, ended_at)
    VALUES (v_member, v_project,
            '2026-04-03 12:00:00+00',
            '2026-04-03 11:00:00+00')  -- reversed
    RETURNING id, duration_seconds INTO v_te3, v_dur;
  IF v_dur <> 0 THEN
    RAISE EXCEPTION '[P4E-FAIL 9]  negative duration not clamped (got %)', v_dur;
  END IF;
  DELETE FROM time_entries WHERE id = v_te3;
  RAISE NOTICE '[P4E-OK  9 ] negative duration clamped to 0';

  -- ---------- 10) uq_time_entries_one_running_per_user (per-user) -------------
  -- member has zero running now; start one.
  INSERT INTO time_entries (user_id, project_id, started_at)
    VALUES (v_member, v_project, '2026-04-04 10:00:00+00')
    RETURNING id INTO v_te3;

  BEGIN
    INSERT INTO time_entries (user_id, project_id, started_at)
      VALUES (v_member, v_project, '2026-04-04 10:30:00+00');
    RAISE EXCEPTION '[P4E-FAIL 10a] second running timer for same user accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  RAISE NOTICE '[P4E-OK  10a] second running timer for same user REJECTED';

  -- ---------- 11) running timer allowed for a DIFFERENT user ------------------
  INSERT INTO time_entries (user_id, project_id, started_at)
    VALUES (v_other, v_project, '2026-04-04 10:30:00+00');
  RAISE NOTICE '[P4E-OK  11 ] running timer allowed concurrently for another user';

  -- ---------- 12) after stopping, can start a NEW running timer ---------------
  UPDATE time_entries SET ended_at = '2026-04-04 11:00:00+00' WHERE id = v_te3;
  INSERT INTO time_entries (user_id, project_id, started_at)
    VALUES (v_member, v_project, '2026-04-04 11:05:00+00');
  RAISE NOTICE '[P4E-OK  12 ] can resume with a new timer after stopping';

  -- ---------- 13) milestone delete: time_entries.milestone_id → NULL ----------
  -- v_te1 pointed at v_m2.
  DELETE FROM milestones WHERE id = v_m2;
  SELECT milestone_id INTO v_approved FROM time_entries WHERE id = v_te1;  -- reuse var
  IF v_approved IS NOT NULL THEN
    RAISE EXCEPTION '[P4E-FAIL 13] time_entries.milestone_id NOT set to NULL on milestone delete';
  END IF;
  RAISE NOTICE '[P4E-OK  13 ] milestone delete sets time_entries.milestone_id = NULL';

  -- ---------- 14) milestone_assignees composite PK + cascade ------------------
  INSERT INTO milestone_assignees (milestone_id, user_id) VALUES (v_m3, v_member);
  BEGIN
    INSERT INTO milestone_assignees (milestone_id, user_id) VALUES (v_m3, v_member);
    RAISE EXCEPTION '[P4E-FAIL 14a] duplicate assignee accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  INSERT INTO milestone_assignees (milestone_id, user_id) VALUES (v_m3, v_other);

  SELECT COUNT(*) INTO v_count FROM milestone_assignees WHERE milestone_id = v_m3;
  IF v_count <> 2 THEN
    RAISE EXCEPTION '[P4E-FAIL 14b] expected 2 assignees, got %', v_count;
  END IF;

  DELETE FROM milestones WHERE id = v_m3;
  SELECT COUNT(*) INTO v_count FROM milestone_assignees WHERE milestone_id = v_m3;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[P4E-FAIL 14c] milestone delete did not cascade assignees (% left)', v_count;
  END IF;
  RAISE NOTICE '[P4E-OK  14 ] milestone_assignees PK + cascade';

  -- ---------- 15) project delete cascades time_entries + milestones -----------
  SELECT COUNT(*) INTO v_count FROM time_entries WHERE project_id = v_project;
  IF v_count < 2 THEN
    RAISE EXCEPTION '[P4E-FAIL 15a] expected leftover time_entries before cascade, got %', v_count;
  END IF;

  DELETE FROM projects WHERE id = v_project;
  SELECT COUNT(*) INTO v_count FROM time_entries WHERE project_id = v_project;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[P4E-FAIL 15b] project delete did not cascade time_entries (% left)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM milestones WHERE project_id = v_project;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[P4E-FAIL 15c] project delete did not cascade milestones (% left)', v_count;
  END IF;
  RAISE NOTICE '[P4E-OK  15 ] project delete cascades time_entries + milestones';

  -- ---------- 16) time_entries RLS: 4 per-operation policies exist ------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname='public' AND tablename='time_entries'
    AND policyname IN ('time_entries_select','time_entries_insert',
                       'time_entries_update','time_entries_delete');
  IF v_count <> 4 THEN
    RAISE EXCEPTION '[P4E-FAIL 16] expected 4 time_entries policies, found %', v_count;
  END IF;

  -- And ensure the old wide-open "ALL" policy is gone.
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname='public' AND tablename='time_entries'
    AND cmd = 'ALL';
  IF v_count > 0 THEN
    RAISE EXCEPTION '[P4E-FAIL 16b] legacy wide-open ALL policy still present on time_entries';
  END IF;
  RAISE NOTICE '[P4E-OK  16 ] RLS = 4 per-op policies, no ALL policy';

  -- ---------- 17) required indexes present ------------------------------------
  FOR v_exists IN
    SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=i)
    FROM unnest(ARRAY[
      'idx_milestones_board',
      'idx_milestone_assignees_user',
      'idx_milestone_assignees_milestone',
      'idx_time_entries_user_started',
      'idx_time_entries_project_started',
      'idx_time_entries_milestone',
      'idx_time_entries_running',
      'uq_time_entries_one_running_per_user'
    ]) AS i
  LOOP
    IF NOT v_exists THEN
      RAISE EXCEPTION '[P4E-FAIL 17] expected index is missing';
    END IF;
  END LOOP;
  RAISE NOTICE '[P4E-OK  17 ] all 8 Phase 4 indexes present';

  RAISE NOTICE '==================== ALL PHASE 4 CHECKS PASSED ====================';

  -- ---------- Cleanup ---------------------------------------------------------
  DELETE FROM teams    WHERE id = v_team;  -- cascades remaining team-scoped rows
  DELETE FROM profiles WHERE id IN (v_lead, v_member, v_other);
  DELETE FROM auth.users WHERE id IN (v_lead, v_member, v_other);

END $$;

COMMIT;
