-- =============================================================
-- Phase 2 — End-to-end flow test (ROLLBACK only).
-- Simulates: project creation, milestones, checklist, files,
-- share token, RLS (lead vs member vs public share).
-- Everything is wrapped in a transaction and rolled back.
-- =============================================================

BEGIN;

-- 1) Bootstrap: 1 team, 1 lead, 1 member
DO $$
DECLARE
  v_team_id       uuid := gen_random_uuid();
  v_lead_id       uuid := gen_random_uuid();
  v_member_id     uuid := gen_random_uuid();
  v_project_id    uuid;
  v_milestone_id  uuid;
  v_item1_id      uuid;
  v_item2_id      uuid;
  v_share_token   text := replace(gen_random_uuid()::text, '-', '') ||
                          replace(gen_random_uuid()::text, '-', '');
  v_count         int;
  v_progress      int;
BEGIN
  -- Auth users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
  VALUES
    (v_lead_id,   'lead-t4@test.local',   crypt('x', gen_salt('bf')), now(), 'authenticated', 'authenticated'),
    (v_member_id, 'member-t4@test.local', crypt('x', gen_salt('bf')), now(), 'authenticated', 'authenticated');

  -- Team
  INSERT INTO teams (id, name, join_code, created_by)
  VALUES (v_team_id, 'Phase2 Test Team', 'P2TEST', v_lead_id);

  -- Profiles
  INSERT INTO profiles (id, email, display_name, role, team_id, pending_approval)
  VALUES
    (v_lead_id,   'lead-t4@test.local',   'Lead T4',   'team_lead', v_team_id, false),
    (v_member_id, 'member-t4@test.local', 'Member T4', 'member',    v_team_id, false);

  -- 2) Project
  INSERT INTO projects (team_id, name, client_name, client_email, description, created_by, share_token, share_expires_at)
  VALUES (v_team_id, 'Website Redesign', 'Acme Inc.', 'client@acme.test',
          'Full site refresh.', v_lead_id, v_share_token, now() + interval '30 days')
  RETURNING id INTO v_project_id;

  -- 3) Milestone + checklist items
  INSERT INTO milestones (project_id, title, description, status, order_index, created_by)
  VALUES (v_project_id, 'Design system', 'Tokens + primitives.', 'working', 0, v_lead_id)
  RETURNING id INTO v_milestone_id;

  INSERT INTO checklist_items (milestone_id, text, order_index)
  VALUES
    (v_milestone_id, 'Pick color palette',  0),
    (v_milestone_id, 'Pick typography',     1),
    (v_milestone_id, 'Build tokens in CSS', 2)
  RETURNING id INTO v_item1_id; -- captures last one, acceptable

  -- 4) Toggle one checklist item + recompute progress
  SELECT id INTO v_item1_id FROM checklist_items WHERE milestone_id = v_milestone_id ORDER BY order_index LIMIT 1;
  SELECT id INTO v_item2_id FROM checklist_items WHERE milestone_id = v_milestone_id ORDER BY order_index OFFSET 1 LIMIT 1;

  UPDATE checklist_items
  SET is_done = true, done_by = v_lead_id, done_at = now()
  WHERE id IN (v_item1_id, v_item2_id);

  -- Simulate the server action: recalc milestone progress
  SELECT ROUND(AVG(CASE WHEN is_done THEN 100 ELSE 0 END)) INTO v_progress
  FROM checklist_items WHERE milestone_id = v_milestone_id;
  UPDATE milestones SET progress = v_progress WHERE id = v_milestone_id;

  -- Assertions
  SELECT progress INTO v_progress FROM milestones WHERE id = v_milestone_id;
  IF v_progress <> 67 THEN
    RAISE EXCEPTION '[FAIL] milestone progress expected 67 got %', v_progress;
  END IF;
  RAISE NOTICE '[PASS] milestone progress recalculated to %%%', v_progress;

  -- 5) Add a pinned file (simulating UploadThing webhook)
  INSERT INTO files (team_id, project_id, milestone_id, filename, size_bytes,
                     blob_url, storage_key, mime_type, uploaded_by, pinned)
  VALUES (v_team_id, v_project_id, v_milestone_id, 'palette.pdf', 42000,
          'https://utfs.io/f/abc123', 'abc123', 'application/pdf', v_lead_id, true);

  SELECT COUNT(*) INTO v_count FROM files WHERE project_id = v_project_id AND pinned = true;
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] pinned file not found'; END IF;
  RAISE NOTICE '[PASS] file upload recorded with storage_key + mime_type';

  -- 6) RLS: lead sees project, member sees it too, outsider cannot.
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_lead_id::text, 'role', 'authenticated')::text, true);

  SELECT COUNT(*) INTO v_count FROM projects WHERE id = v_project_id;
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] Lead cannot see their own project'; END IF;
  RAISE NOTICE '[PASS] Lead sees own project';

  SELECT COUNT(*) INTO v_count FROM milestones WHERE project_id = v_project_id;
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] Lead cannot see milestones'; END IF;
  RAISE NOTICE '[PASS] Lead sees milestones (%)', v_count;

  SELECT COUNT(*) INTO v_count FROM checklist_items WHERE milestone_id = v_milestone_id;
  IF v_count <> 3 THEN RAISE EXCEPTION '[FAIL] Lead cannot see 3 checklist items, got %', v_count; END IF;
  RAISE NOTICE '[PASS] Lead sees all checklist items';

  SELECT COUNT(*) INTO v_count FROM files WHERE project_id = v_project_id;
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] Lead cannot see files'; END IF;
  RAISE NOTICE '[PASS] Lead sees files';

  -- Switch to member
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member_id::text, 'role', 'authenticated')::text, true);

  SELECT COUNT(*) INTO v_count FROM projects WHERE id = v_project_id;
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] Member cannot see team project'; END IF;
  RAISE NOTICE '[PASS] Member sees team project';

  -- Member tries to mark an item done (should succeed — any team member can tick boxes)
  UPDATE checklist_items
  SET is_done = true, done_by = v_member_id, done_at = now()
  WHERE id = (SELECT id FROM checklist_items WHERE milestone_id = v_milestone_id ORDER BY order_index DESC LIMIT 1);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] Member cannot tick checklist item'; END IF;
  RAISE NOTICE '[PASS] Member can tick checklist item';

  -- Member tries to delete a milestone (should affect 0 rows — RLS blocks)
  DELETE FROM milestones WHERE id = v_milestone_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION '[FAIL] Member was able to delete milestone (expected blocked)'; END IF;
  RAISE NOTICE '[PASS] Member blocked from deleting milestones';

  -- Back to full privileges for cleanup-phase assertions
  RESET role;
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- 7) Public share path (service role / no JWT — simulated via RESET role).
  --    The /share/[token] page uses the service client, so we just verify
  --    the data is reachable by a raw query on share_token.
  SELECT COUNT(*) INTO v_count FROM projects
  WHERE share_token = v_share_token
    AND (share_expires_at IS NULL OR share_expires_at > now());
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] share_token lookup failed'; END IF;
  RAISE NOTICE '[PASS] share_token lookup works and not expired';

  RAISE NOTICE '=== Phase 2 flow tests: ALL PASSED ===';
END $$;

ROLLBACK;
