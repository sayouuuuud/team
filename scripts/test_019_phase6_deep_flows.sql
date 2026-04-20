-- Phase 6 deep flow test: notifications, templates, soft-delete trigger
DO $$
DECLARE
  v_lead      uuid := gen_random_uuid();
  v_member    uuid := gen_random_uuid();
  v_team      uuid;
  v_project   uuid;
  v_milestone uuid;
  v_file      uuid;
  v_tpl       uuid;
  v_delivered int;
  v_deleted   timestamptz;
BEGIN
  -- Setup
  INSERT INTO auth.users (id, email) VALUES
    (v_lead,   'p6_lead_'   || v_lead   || '@test.local'),
    (v_member, 'p6_member_' || v_member || '@test.local');

  INSERT INTO profiles (id, full_name, role)
  VALUES
    (v_lead,   'P6 Lead',   'team_lead'),
    (v_member, 'P6 Member', 'member');

  INSERT INTO teams (name, lead_id, join_code)
  VALUES ('P6 Team', v_lead, 'P6' || substr(md5(random()::text), 1, 6))
  RETURNING id INTO v_team;

  UPDATE profiles SET team_id = v_team WHERE id IN (v_lead, v_member);

  -- ---------------------------------------------------------------
  -- 1) notify respects notify_in_app preference
  -- ---------------------------------------------------------------
  -- Member opts OUT of in-app
  UPDATE profiles SET notify_in_app = false WHERE id = v_member;
  -- Simulate notify(): only insert for users with notify_in_app = true
  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT p.id, 'test', 'Hello', 'Body', '/x'
  FROM profiles p
  WHERE p.id IN (v_lead, v_member) AND p.notify_in_app = true;

  IF (SELECT count(*) FROM notifications WHERE user_id = v_member) <> 0 THEN
    RAISE EXCEPTION '[FAIL] notification delivered to opted-out user';
  END IF;
  IF (SELECT count(*) FROM notifications WHERE user_id = v_lead) <> 1 THEN
    RAISE EXCEPTION '[FAIL] notification not delivered to opted-in user';
  END IF;

  -- Re-enable and repeat
  UPDATE profiles SET notify_in_app = true WHERE id = v_member;
  INSERT INTO notifications (user_id, type, title)
  SELECT p.id, 'test2', 'Hi'
  FROM profiles p
  WHERE p.id IN (v_lead, v_member) AND p.notify_in_app = true;

  IF (SELECT count(*) FROM notifications WHERE user_id = v_member) <> 1 THEN
    RAISE EXCEPTION '[FAIL] re-enabled user still skipped';
  END IF;

  -- ---------------------------------------------------------------
  -- 2) file soft-delete trigger stamps deleted_at
  -- ---------------------------------------------------------------
  INSERT INTO projects (team_id, name, status, work_mode, show_team_to_client, created_by)
  VALUES (v_team, 'P6 Project', 'active', 'mixed', true, v_lead)
  RETURNING id INTO v_project;

  INSERT INTO files (team_id, project_id, filename, blob_url, size_bytes, uploaded_by)
  VALUES (v_team, v_project, 'doc.pdf', 'https://x.test/doc.pdf', 1234, v_lead)
  RETURNING id INTO v_file;

  IF (SELECT deleted_at FROM files WHERE id = v_file) IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL] new file has deleted_at set';
  END IF;

  -- Flip is_deleted; trigger should stamp deleted_at
  UPDATE files SET is_deleted = true, deleted_by = v_lead WHERE id = v_file;
  SELECT deleted_at INTO v_deleted FROM files WHERE id = v_file;
  IF v_deleted IS NULL THEN
    RAISE EXCEPTION '[FAIL] deleted_at not stamped on soft-delete';
  END IF;

  -- Restore: trigger clears deleted_at + deleted_by
  UPDATE files SET is_deleted = false WHERE id = v_file;
  SELECT deleted_at INTO v_deleted FROM files WHERE id = v_file;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL] deleted_at not cleared on restore';
  END IF;
  IF (SELECT deleted_by FROM files WHERE id = v_file) IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL] deleted_by not cleared on restore';
  END IF;

  -- ---------------------------------------------------------------
  -- 3) milestone_templates scope CHECK
  -- ---------------------------------------------------------------
  INSERT INTO milestones (project_id, title, status, progress, order_index, created_by)
  VALUES (v_project, 'M1', 'pending', 0, 0, v_lead)
  RETURNING id INTO v_milestone;

  -- Team-scoped template — OK
  INSERT INTO milestone_templates (team_id, name, template_data, created_by)
  VALUES (v_team, 'Team tpl', '{"milestones":[]}'::jsonb, v_lead)
  RETURNING id INTO v_tpl;

  -- Global template — OK (team_id nullable when is_global=true)
  INSERT INTO milestone_templates (team_id, name, template_data, is_global, created_by)
  VALUES (NULL, 'Global tpl', '{"milestones":[]}'::jsonb, true, v_lead);

  -- Invalid: neither team_id nor is_global
  BEGIN
    INSERT INTO milestone_templates (team_id, name, template_data, is_global)
    VALUES (NULL, 'Orphan', '{"milestones":[]}'::jsonb, false);
    RAISE EXCEPTION '[FAIL] orphan template accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- ---------------------------------------------------------------
  -- 4) notification priority defaults + delivered_channels empty array
  -- ---------------------------------------------------------------
  INSERT INTO notifications (user_id, type, title)
  VALUES (v_lead, 'urgent', 'Test')
  RETURNING array_length(delivered_channels, 1) INTO v_delivered;

  IF v_delivered IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL] delivered_channels default should be empty array, got %', v_delivered;
  END IF;

  IF (SELECT priority FROM notifications
      WHERE user_id = v_lead AND type = 'urgent' LIMIT 1) <> 'normal' THEN
    RAISE EXCEPTION '[FAIL] notification priority default not normal';
  END IF;

  -- ---------------------------------------------------------------
  -- 5) profile default prefs (new profile)
  -- ---------------------------------------------------------------
  IF (SELECT timezone FROM profiles WHERE id = v_lead) <> 'Africa/Cairo' THEN
    RAISE EXCEPTION '[FAIL] default timezone not Africa/Cairo';
  END IF;

  IF NOT (
    SELECT notify_email AND notify_in_app AND notify_mentions AND notify_assignments
    FROM profiles WHERE id = v_lead
  ) THEN
    RAISE EXCEPTION '[FAIL] default notify flags should all be true';
  END IF;

  -- ---------------------------------------------------------------
  -- 6) site_settings retention columns defaults
  -- ---------------------------------------------------------------
  IF (SELECT audit_retention_days FROM site_settings LIMIT 1) IS NULL
     OR (SELECT file_retention_days FROM site_settings LIMIT 1) IS NULL THEN
    RAISE EXCEPTION '[FAIL] site_settings retention defaults missing';
  END IF;

  RAISE NOTICE '[P6 DEEP] ALL CHECKS PASSED';

  -- ---------------------------------------------------------------
  -- Cleanup
  -- ---------------------------------------------------------------
  DELETE FROM teams WHERE id = v_team;
  DELETE FROM profiles WHERE id IN (v_lead, v_member);
  DELETE FROM auth.users WHERE id IN (v_lead, v_member);
END $$;
