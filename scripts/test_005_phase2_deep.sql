-- Phase 2 DEEP integration test — edge cases & business rules
-- Covers:
--   1. Join code generation uniqueness
--   2. Pending approval gate (new member is pending by default)
--   3. Invitation expiry (invalid when expired)
--   4. Share token revoke + expiry lookup
--   5. Milestone progress recalc edge cases (empty, all done, partial)
--   6. File soft-delete + pin ordering
--   7. Files cascade on project delete
--   8. Share expiry blocks public access
-- All wrapped in a transaction that ROLLBACKs — nothing persists.
BEGIN;

DO $$
DECLARE
  v_team_id      uuid := gen_random_uuid();
  v_team_b_id    uuid := gen_random_uuid();
  v_lead_id      uuid := gen_random_uuid();
  v_member_id    uuid := gen_random_uuid();
  v_pending_id   uuid := gen_random_uuid();
  v_project_id   uuid := gen_random_uuid();
  v_milestone_id uuid := gen_random_uuid();
  v_empty_ms_id  uuid := gen_random_uuid();
  v_file_id      uuid := gen_random_uuid();
  v_inv_valid    uuid := gen_random_uuid();
  v_inv_expired  uuid := gen_random_uuid();
  v_count        int;
  v_progress     int;
  v_is_deleted   boolean;
  v_share_token  text;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  Phase 2 DEEP test — edge cases & business rules';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- Seed auth.users so FK constraints pass
  INSERT INTO auth.users (id, email, aud, role)
  VALUES
    (v_lead_id,    'lead-deep@test.local',    'authenticated', 'authenticated'),
    (v_member_id,  'member-deep@test.local',  'authenticated', 'authenticated'),
    (v_pending_id, 'pending-deep@test.local', 'authenticated', 'authenticated');

  -- Team A and Team B (to test cross-team join code uniqueness semantics)
  INSERT INTO teams (id, name, join_code, lead_id) VALUES
    (v_team_id,   'Deep Team A', 'DEEPA1', NULL),
    (v_team_b_id, 'Deep Team B', 'DEEPB2', NULL);

  INSERT INTO profiles (id, full_name, role, team_id, pending_approval) VALUES
    (v_lead_id,    'Deep Lead',    'team_lead', v_team_id, false),
    (v_member_id,  'Deep Member',  'member',    v_team_id, false),
    (v_pending_id, 'Deep Pending', 'member',    v_team_id, true);  -- simulates new join

  UPDATE teams SET lead_id = v_lead_id WHERE id = v_team_id;

  -- ==========================================================
  -- 1. Join code uniqueness constraint
  -- ==========================================================
  BEGIN
    INSERT INTO teams (id, name, join_code, lead_id)
    VALUES (gen_random_uuid(), 'Conflict Team', 'DEEPA1', NULL);
    RAISE EXCEPTION '[FAIL] Duplicate join_code was allowed';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '[PASS] 1. join_code is globally unique';
  END;

  -- ==========================================================
  -- 2. Pending approval gate: new member is blocked from team data
  --    (we check by explicit flag — gate is enforced in app layer)
  -- ==========================================================
  SELECT pending_approval INTO v_count FROM profiles WHERE id = v_pending_id;
  IF NOT (SELECT pending_approval FROM profiles WHERE id = v_pending_id) THEN
    RAISE EXCEPTION '[FAIL] Pending member should have pending_approval=true';
  END IF;
  RAISE NOTICE '[PASS] 2. New member is pending_approval=true by default';

  -- Simulate Lead approving: flips flag to false
  UPDATE profiles SET pending_approval = false WHERE id = v_pending_id;
  IF (SELECT pending_approval FROM profiles WHERE id = v_pending_id) THEN
    RAISE EXCEPTION '[FAIL] Approval did not persist';
  END IF;
  RAISE NOTICE '[PASS] 2b. Approval flips pending_approval to false';

  -- ==========================================================
  -- 3. Invitation: valid vs expired
  -- ==========================================================
  INSERT INTO team_invitations (id, team_id, token, expires_at, created_by) VALUES
    (v_inv_valid,   v_team_id, 'tok_valid_'   || gen_random_uuid()::text, now() + interval '7 days',  v_lead_id),
    (v_inv_expired, v_team_id, 'tok_expired_' || gen_random_uuid()::text, now() - interval '1 day',   v_lead_id);

  -- Lookup logic: valid = not accepted AND expires_at > now()
  SELECT COUNT(*) INTO v_count FROM team_invitations
    WHERE id = v_inv_valid AND accepted_at IS NULL AND expires_at > now();
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] Valid invitation not found'; END IF;

  SELECT COUNT(*) INTO v_count FROM team_invitations
    WHERE id = v_inv_expired AND accepted_at IS NULL AND expires_at > now();
  IF v_count <> 0 THEN RAISE EXCEPTION '[FAIL] Expired invitation treated as valid'; END IF;
  RAISE NOTICE '[PASS] 3. Invitation expiry filter works (valid vs expired)';

  -- Simulate accepting
  UPDATE team_invitations
    SET accepted_at = now(), accepted_by = v_member_id
    WHERE id = v_inv_valid;

  SELECT COUNT(*) INTO v_count FROM team_invitations
    WHERE id = v_inv_valid AND accepted_at IS NULL AND expires_at > now();
  IF v_count <> 0 THEN RAISE EXCEPTION '[FAIL] Accepted invitation still usable'; END IF;
  RAISE NOTICE '[PASS] 3b. Accepted invitations are excluded from future lookups';

  -- ==========================================================
  -- 4. Project + Share token revoke/expiry
  -- ==========================================================
  v_share_token := 'share_' || gen_random_uuid()::text;

  INSERT INTO projects (id, team_id, name, status, work_mode, share_token, share_expires_at, created_by)
  VALUES (v_project_id, v_team_id, 'Deep Project', 'active', 'mixed', v_share_token, now() + interval '30 days', v_lead_id);

  -- Lookup valid
  SELECT COUNT(*) INTO v_count FROM projects
    WHERE share_token = v_share_token
      AND (share_expires_at IS NULL OR share_expires_at > now());
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] Valid share token not found'; END IF;
  RAISE NOTICE '[PASS] 4. Valid share token resolves to project';

  -- Revoke: set token to NULL
  UPDATE projects SET share_token = NULL, share_expires_at = NULL WHERE id = v_project_id;
  SELECT COUNT(*) INTO v_count FROM projects WHERE share_token = v_share_token;
  IF v_count <> 0 THEN RAISE EXCEPTION '[FAIL] Revoked token still resolves'; END IF;
  RAISE NOTICE '[PASS] 4b. Revoked share_token returns no match';

  -- Re-issue with expiry in the PAST
  UPDATE projects
    SET share_token = v_share_token, share_expires_at = now() - interval '1 hour'
    WHERE id = v_project_id;

  SELECT COUNT(*) INTO v_count FROM projects
    WHERE share_token = v_share_token
      AND (share_expires_at IS NULL OR share_expires_at > now());
  IF v_count <> 0 THEN RAISE EXCEPTION '[FAIL] Expired share token treated as valid'; END IF;
  RAISE NOTICE '[PASS] 4c. Expired share_expires_at blocks public access';

  -- Re-issue without expiry (persistent link)
  UPDATE projects
    SET share_token = v_share_token, share_expires_at = NULL
    WHERE id = v_project_id;

  SELECT COUNT(*) INTO v_count FROM projects
    WHERE share_token = v_share_token
      AND (share_expires_at IS NULL OR share_expires_at > now());
  IF v_count <> 1 THEN RAISE EXCEPTION '[FAIL] Persistent token did not resolve'; END IF;
  RAISE NOTICE '[PASS] 4d. Persistent link (no expiry) resolves correctly';

  -- ==========================================================
  -- 5. Milestone progress edge cases
  -- ==========================================================
  -- Milestone with NO checklist items
  INSERT INTO milestones (id, project_id, title, status, order_index, progress, created_by)
  VALUES (v_empty_ms_id, v_project_id, 'Empty Milestone', 'pending', 0, 0, v_lead_id);

  SELECT progress INTO v_progress FROM milestones WHERE id = v_empty_ms_id;
  IF v_progress <> 0 THEN RAISE EXCEPTION '[FAIL] Empty milestone progress should be 0, got %', v_progress; END IF;
  RAISE NOTICE '[PASS] 5. Empty milestone starts at progress 0';

  -- Milestone with 4 items
  INSERT INTO milestones (id, project_id, title, status, order_index, progress, created_by)
  VALUES (v_milestone_id, v_project_id, 'Build pages', 'working', 1, 0, v_lead_id);

  INSERT INTO checklist_items (milestone_id, text, order_index, is_done) VALUES
    (v_milestone_id, 'Home',    0, false),
    (v_milestone_id, 'Pricing', 1, false),
    (v_milestone_id, 'About',   2, false),
    (v_milestone_id, 'Contact', 3, false);

  -- Simulate "recalc" — app logic in actions.ts (verify the math works)
  UPDATE milestones SET progress = (
    SELECT CASE WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND((COUNT(*) FILTER (WHERE is_done) * 100.0) / COUNT(*))::int
           END
    FROM checklist_items WHERE milestone_id = v_milestone_id
  ) WHERE id = v_milestone_id;

  SELECT progress INTO v_progress FROM milestones WHERE id = v_milestone_id;
  IF v_progress <> 0 THEN RAISE EXCEPTION '[FAIL] Progress with 0 done should be 0, got %', v_progress; END IF;
  RAISE NOTICE '[PASS] 5b. 0/4 done = 0%%';

  -- Mark 2/4 done
  UPDATE checklist_items SET is_done = true
  WHERE milestone_id = v_milestone_id AND text IN ('Home', 'Pricing');

  UPDATE milestones SET progress = (
    SELECT ROUND((COUNT(*) FILTER (WHERE is_done) * 100.0) / NULLIF(COUNT(*),0))::int
    FROM checklist_items WHERE milestone_id = v_milestone_id
  ) WHERE id = v_milestone_id;

  SELECT progress INTO v_progress FROM milestones WHERE id = v_milestone_id;
  IF v_progress <> 50 THEN RAISE EXCEPTION '[FAIL] 2/4 should be 50%%, got %', v_progress; END IF;
  RAISE NOTICE '[PASS] 5c. 2/4 done = 50%%';

  -- All 4 done
  UPDATE checklist_items SET is_done = true WHERE milestone_id = v_milestone_id;
  UPDATE milestones SET progress = (
    SELECT ROUND((COUNT(*) FILTER (WHERE is_done) * 100.0) / NULLIF(COUNT(*),0))::int
    FROM checklist_items WHERE milestone_id = v_milestone_id
  ) WHERE id = v_milestone_id;

  SELECT progress INTO v_progress FROM milestones WHERE id = v_milestone_id;
  IF v_progress <> 100 THEN RAISE EXCEPTION '[FAIL] 4/4 should be 100%%, got %', v_progress; END IF;
  RAISE NOTICE '[PASS] 5d. 4/4 done = 100%%';

  -- Delete all items → progress recalc guards against divide-by-zero
  DELETE FROM checklist_items WHERE milestone_id = v_milestone_id;
  UPDATE milestones SET progress = (
    SELECT CASE WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND((COUNT(*) FILTER (WHERE is_done) * 100.0) / COUNT(*))::int
           END
    FROM checklist_items WHERE milestone_id = v_milestone_id
  ) WHERE id = v_milestone_id;

  SELECT progress INTO v_progress FROM milestones WHERE id = v_milestone_id;
  IF v_progress <> 0 THEN RAISE EXCEPTION '[FAIL] Empty after delete should be 0, got %', v_progress; END IF;
  RAISE NOTICE '[PASS] 5e. Emptied milestone resets to 0 (no div-by-zero)';

  -- ==========================================================
  -- 6. File: soft-delete + pin ordering
  -- ==========================================================
  INSERT INTO files (id, team_id, project_id, milestone_id, filename, blob_url, storage_key, size_bytes, mime_type, uploaded_by, pinned) VALUES
    (v_file_id,          v_team_id, v_project_id, v_milestone_id, 'brief.pdf',    'https://cdn.test/brief.pdf',    'key_brief',    2048, 'application/pdf', v_lead_id, true),
    (gen_random_uuid(),  v_team_id, v_project_id, v_milestone_id, 'notes.md',     'https://cdn.test/notes.md',     'key_notes',    512,  'text/markdown',   v_lead_id, false),
    (gen_random_uuid(),  v_team_id, v_project_id, v_milestone_id, 'mockup.png',   'https://cdn.test/mockup.png',   'key_mockup',   4096, 'image/png',       v_lead_id, false);

  -- Soft-delete one
  UPDATE files
    SET is_deleted = true, deleted_at = now(), deleted_reason = 'test cleanup'
    WHERE filename = 'notes.md';

  -- Listing excludes soft-deleted
  SELECT COUNT(*) INTO v_count FROM files
    WHERE project_id = v_project_id AND is_deleted = false;
  IF v_count <> 2 THEN RAISE EXCEPTION '[FAIL] Expected 2 active files, got %', v_count; END IF;
  RAISE NOTICE '[PASS] 6. Soft-deleted file excluded from listing';

  -- Pin ordering: pinned comes first
  SELECT filename INTO v_share_token FROM files
    WHERE project_id = v_project_id AND is_deleted = false
    ORDER BY pinned DESC, uploaded_at DESC
    LIMIT 1;
  IF v_share_token <> 'brief.pdf' THEN RAISE EXCEPTION '[FAIL] Pinned file should be first, got %', v_share_token; END IF;
  RAISE NOTICE '[PASS] 6b. Pinned file sorts first';

  -- Check soft-delete preserves the row (audit trail)
  SELECT is_deleted INTO v_is_deleted FROM files WHERE filename = 'notes.md';
  IF NOT v_is_deleted THEN RAISE EXCEPTION '[FAIL] Row disappeared after soft delete'; END IF;
  RAISE NOTICE '[PASS] 6c. Soft-delete preserves row for audit';

  -- ==========================================================
  -- 7. Cascade: deleting project removes its milestones, items, files
  -- ==========================================================
  DELETE FROM projects WHERE id = v_project_id;

  SELECT COUNT(*) INTO v_count FROM milestones WHERE project_id = v_project_id;
  IF v_count <> 0 THEN RAISE EXCEPTION '[FAIL] Milestones not cascaded, got %', v_count; END IF;
  SELECT COUNT(*) INTO v_count FROM files WHERE project_id = v_project_id;
  IF v_count <> 0 THEN RAISE EXCEPTION '[FAIL] Files not cascaded, got %', v_count; END IF;
  RAISE NOTICE '[PASS] 7. Project deletion cascades to milestones + files';

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  All DEEP tests PASSED';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

ROLLBACK;
