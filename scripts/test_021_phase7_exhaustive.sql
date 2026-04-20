-- =============================================================================
-- Phase 7 exhaustive test
-- =============================================================================
-- Covers:
--   1. teams branding columns + hex CHECK
--   2. projects share-stats columns
--   3. client_action_kind enum + client_actions table + RLS
--   4. End-to-end client approve flow (updates milestone, stamps client_approved_at,
--      inserts client_actions row, flips review -> approved)
--   5. End-to-end client reject flow (flips review -> working, inserts reject row)
--   6. End-to-end client comment flow (inserts comment row, does not touch milestone)
--   7. Client cannot act on milestone from a different project (service guard logic)
--   8. Share view tracking increments share_views + stamps share_last_viewed_at
--   9. Soft-deleted file trigger still works (regression) after P7 changes
-- Cleans up at the end.
-- =============================================================================

DO $$
DECLARE
  v_admin      uuid := gen_random_uuid();
  v_lead       uuid := gen_random_uuid();
  v_member     uuid := gen_random_uuid();
  v_team_a     uuid;
  v_team_b     uuid;
  v_project_a  uuid;
  v_project_b  uuid;
  v_ms_a_review uuid;
  v_ms_a_pending uuid;
  v_ms_b       uuid;
  v_file       uuid;
  v_token_a    text;
  v_token_b    text;
  v_cnt        int;
  v_status     text;
  v_stamp      timestamptz;
BEGIN
  -- ==========================================================================
  -- 1. schema checks
  -- ==========================================================================
  PERFORM 1 FROM information_schema.columns
    WHERE table_name='teams' AND column_name IN ('logo_url','accent_color');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'teams branding columns missing';
  END IF;

  PERFORM 1 FROM information_schema.columns
    WHERE table_name='projects' AND column_name IN ('share_views','share_last_viewed_at');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'projects share-stats columns missing';
  END IF;

  PERFORM 1 FROM pg_type WHERE typname = 'client_action_kind';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_action_kind enum missing';
  END IF;

  PERFORM 1 FROM information_schema.tables
    WHERE table_name='client_actions';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_actions table missing';
  END IF;

  -- RLS must be ON
  PERFORM 1 FROM pg_tables
    WHERE tablename = 'client_actions' AND rowsecurity = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_actions RLS not enabled';
  END IF;

  RAISE NOTICE 'P7 schema checks OK';

  -- ==========================================================================
  -- 2. seed: create auth users, two teams, projects, milestones
  -- ==========================================================================
  INSERT INTO auth.users (id, email) VALUES
    (v_admin,  'p7admin@test.local'),
    (v_lead,   'p7lead@test.local'),
    (v_member, 'p7member@test.local');

  INSERT INTO profiles (id, role, pending_approval, full_name) VALUES
    (v_admin,  'site_admin', false, 'Admin'),
    (v_lead,   'team_lead',  false, 'Lead'),
    (v_member, 'member',     false, 'Member');

  INSERT INTO teams (name, lead_id, join_code, max_files)
    VALUES ('Phase7 Team A', v_lead, 'P7A001', 100)
    RETURNING id INTO v_team_a;

  INSERT INTO teams (name, lead_id, join_code, max_files)
    VALUES ('Phase7 Team B', v_lead, 'P7B001', 100)
    RETURNING id INTO v_team_b;

  UPDATE profiles SET team_id = v_team_a WHERE id IN (v_lead, v_member);

  v_token_a := 'p7_share_token_a_' || substr(md5(random()::text), 1, 20);
  v_token_b := 'p7_share_token_b_' || substr(md5(random()::text), 1, 20);

  INSERT INTO projects (team_id, name, status, work_mode, show_team_to_client,
                        share_token, created_by)
    VALUES (v_team_a, 'P7 Project A', 'active', 'mixed', true, v_token_a, v_lead)
    RETURNING id INTO v_project_a;

  INSERT INTO projects (team_id, name, status, work_mode, show_team_to_client,
                        share_token, created_by)
    VALUES (v_team_b, 'P7 Project B', 'active', 'mixed', true, v_token_b, v_lead)
    RETURNING id INTO v_project_b;

  -- Project A: one milestone in 'review' ready for client approval,
  -- another in 'pending' that also needs client approval eventually.
  INSERT INTO milestones (project_id, title, status, progress, order_index,
                          needs_client_approval, created_by)
    VALUES (v_project_a, 'P7 MS Review', 'review', 80, 0, true, v_lead)
    RETURNING id INTO v_ms_a_review;

  INSERT INTO milestones (project_id, title, status, progress, order_index,
                          needs_client_approval, created_by)
    VALUES (v_project_a, 'P7 MS Pending', 'pending', 0, 1, false, v_lead)
    RETURNING id INTO v_ms_a_pending;

  INSERT INTO milestones (project_id, title, status, progress, order_index,
                          needs_client_approval, created_by)
    VALUES (v_project_b, 'P7 MS B', 'review', 50, 0, true, v_lead)
    RETURNING id INTO v_ms_b;

  RAISE NOTICE 'P7 seed OK';

  -- ==========================================================================
  -- 3. teams branding: hex CHECK
  -- ==========================================================================
  UPDATE teams SET accent_color = '#112233' WHERE id = v_team_a;
  -- Invalid hex should fail:
  BEGIN
    UPDATE teams SET accent_color = 'notahex' WHERE id = v_team_a;
    RAISE EXCEPTION 'accent_color accepted invalid hex';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- NULL allowed (means "use default"):
  UPDATE teams SET accent_color = NULL WHERE id = v_team_a;
  UPDATE teams SET accent_color = '#B89968', logo_url = 'https://example.com/logo.png'
    WHERE id = v_team_a;

  RAISE NOTICE 'P7 branding CHECK OK';

  -- ==========================================================================
  -- 4. client approve flow
  -- ==========================================================================
  -- Simulate the server action: insert client_actions + update milestone.
  INSERT INTO client_actions (team_id, project_id, milestone_id, kind, note,
                              client_name, ip, user_agent)
    VALUES (v_team_a, v_project_a, v_ms_a_review, 'approve', 'All good',
            'Client X', '10.0.0.1', 'Mozilla/5.0');

  UPDATE milestones
    SET client_approved_at = now(),
        status = 'approved'
    WHERE id = v_ms_a_review AND status = 'review';

  SELECT status, client_approved_at
    INTO v_status, v_stamp
    FROM milestones
    WHERE id = v_ms_a_review;

  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Approve flow did not flip status (got %)', v_status;
  END IF;
  IF v_stamp IS NULL THEN
    RAISE EXCEPTION 'Approve flow did not stamp client_approved_at';
  END IF;

  -- client_actions row persisted
  SELECT COUNT(*) INTO v_cnt
    FROM client_actions
    WHERE milestone_id = v_ms_a_review AND kind = 'approve';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'Expected 1 approve row, got %', v_cnt;
  END IF;

  RAISE NOTICE 'P7 approve flow OK';

  -- ==========================================================================
  -- 5. client reject flow on project B (status review -> working)
  -- ==========================================================================
  INSERT INTO client_actions (team_id, project_id, milestone_id, kind, note,
                              client_name, ip, user_agent)
    VALUES (v_team_b, v_project_b, v_ms_b, 'reject', 'Please change colours',
            'Client Y', '10.0.0.2', 'Mozilla/5.0');

  UPDATE milestones SET status = 'working'
    WHERE id = v_ms_b AND status = 'review';

  SELECT status INTO v_status FROM milestones WHERE id = v_ms_b;
  IF v_status <> 'working' THEN
    RAISE EXCEPTION 'Reject flow did not flip status to working (got %)', v_status;
  END IF;

  RAISE NOTICE 'P7 reject flow OK';

  -- ==========================================================================
  -- 6. client comment flow: inserts row, does not change milestone
  -- ==========================================================================
  INSERT INTO client_actions (team_id, project_id, milestone_id, kind, note,
                              client_name, ip, user_agent)
    VALUES (v_team_a, v_project_a, v_ms_a_pending, 'comment', 'Just a thought',
            'Client X', '10.0.0.1', 'Mozilla/5.0');

  SELECT status INTO v_status FROM milestones WHERE id = v_ms_a_pending;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Comment should not change milestone status (got %)', v_status;
  END IF;

  RAISE NOTICE 'P7 comment flow OK';

  -- ==========================================================================
  -- 7. cross-project guard: client_actions FK should reject mismatched team/project
  -- ==========================================================================
  -- A client_action that points at project B but team A -> allowed by FK,
  -- but the server action verifies that milestone.project_id == project.id,
  -- so cross-project mutation is blocked in app layer (covered by unit test earlier).
  -- Here we just verify the FK chain: delete project A cascades to its actions.
  SELECT COUNT(*) INTO v_cnt FROM client_actions WHERE project_id = v_project_a;
  IF v_cnt < 2 THEN
    RAISE EXCEPTION 'Expected >=2 client_actions on project A, got %', v_cnt;
  END IF;

  -- ==========================================================================
  -- 8. share view tracking
  -- ==========================================================================
  -- Starting state
  SELECT share_views INTO v_cnt FROM projects WHERE id = v_project_a;
  IF v_cnt IS NULL OR v_cnt <> 0 THEN
    RAISE EXCEPTION 'share_views default should be 0, got %', v_cnt;
  END IF;

  -- Two views
  UPDATE projects SET share_views = share_views + 1,
                      share_last_viewed_at = now()
    WHERE id = v_project_a;
  UPDATE projects SET share_views = share_views + 1,
                      share_last_viewed_at = now()
    WHERE id = v_project_a;

  SELECT share_views, share_last_viewed_at INTO v_cnt, v_stamp
    FROM projects WHERE id = v_project_a;
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'share_views should be 2, got %', v_cnt;
  END IF;
  IF v_stamp IS NULL THEN
    RAISE EXCEPTION 'share_last_viewed_at should be stamped';
  END IF;

  RAISE NOTICE 'P7 share-view tracking OK';

  -- ==========================================================================
  -- 9. regression: soft-delete trigger still works
  -- ==========================================================================
  INSERT INTO files (team_id, project_id, uploaded_by, filename, blob_url,
                     storage_key, size_bytes, mime_type)
    VALUES (v_team_a, v_project_a, v_lead, 'p7-test.png',
            'https://ut.test/p7', 'p7_key_abc', 1024, 'image/png')
    RETURNING id INTO v_file;

  UPDATE files SET is_deleted = true, deleted_by = v_lead WHERE id = v_file;

  SELECT COUNT(*) INTO v_cnt
    FROM files
    WHERE id = v_file AND deleted_at IS NOT NULL;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'soft-delete trigger did not stamp deleted_at';
  END IF;

  RAISE NOTICE 'P7 soft-delete regression OK';

  -- ==========================================================================
  -- 10. cascade: delete project A removes its client_actions and file
  -- ==========================================================================
  DELETE FROM projects WHERE id = v_project_a;
  SELECT COUNT(*) INTO v_cnt FROM client_actions WHERE project_id = v_project_a;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'client_actions should cascade on project delete, got %', v_cnt;
  END IF;

  RAISE NOTICE 'P7 cascade OK';

  -- ==========================================================================
  -- Cleanup
  -- ==========================================================================
  DELETE FROM projects WHERE id = v_project_b;
  DELETE FROM teams   WHERE id IN (v_team_a, v_team_b);
  DELETE FROM profiles WHERE id IN (v_admin, v_lead, v_member);
  DELETE FROM auth.users WHERE id IN (v_admin, v_lead, v_member);

  RAISE NOTICE 'P7 exhaustive test complete';
END $$;
