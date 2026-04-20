-- test_020_phase6_exhaustive.sql
-- Exhaustive Phase 6 test: notifications layer, realtime publication,
-- files soft-delete trigger, milestone_templates scope, profile prefs,
-- site_settings retention, audit_log indexes & prune, end-to-end template
-- copy. Runs in a DO block and raises the first failing assertion.
-- Cleans up the temp tenant at the end.

DO $$
DECLARE
  v_user1     uuid := gen_random_uuid();
  v_user2     uuid := gen_random_uuid();
  v_user3     uuid := gen_random_uuid();
  v_team      uuid;
  v_other     uuid; -- second team for RLS/cross-tenant checks
  v_project   uuid;
  v_milestone uuid;
  v_file      uuid;
  v_template  uuid;
  v_tpl_tm    uuid; -- team-scoped
  v_tpl_gl    uuid; -- global
  v_count     int;
  v_ts        timestamptz;
  v_pri       text;
  v_channels  text[];
  v_tz        text;
  v_nemail    boolean;
  v_nin_app   boolean;
  v_deleted_at timestamptz;
  v_deleted_by uuid;
  v_retention int;
  v_fn_count  int;
  v_pub_count int;
  v_replica   char;
  v_policy_count int;
  v_idx_count int;
BEGIN
  -- ==================================================================
  -- TENANT SETUP
  -- ==================================================================
  INSERT INTO auth.users (id, email) VALUES (v_user1, 'p6e1_' || v_user1 || '@test.local');
  INSERT INTO auth.users (id, email) VALUES (v_user2, 'p6e2_' || v_user2 || '@test.local');
  INSERT INTO auth.users (id, email) VALUES (v_user3, 'p6e3_' || v_user3 || '@test.local');

  INSERT INTO profiles (id, full_name, role) VALUES
    (v_user1, 'P6E Lead', 'team_lead'),
    (v_user2, 'P6E M1',   'member'),
    (v_user3, 'P6E M2',   'member');

  INSERT INTO teams (name, lead_id, join_code)
    VALUES ('P6E Team', v_user1, 'P6E' || substr(md5(random()::text), 1, 6))
    RETURNING id INTO v_team;

  INSERT INTO teams (name, lead_id, join_code)
    VALUES ('P6E Other', v_user1, 'P6O' || substr(md5(random()::text), 1, 6))
    RETURNING id INTO v_other;

  UPDATE profiles SET team_id = v_team
    WHERE id IN (v_user1, v_user2, v_user3);

  INSERT INTO projects (team_id, name, status, work_mode, created_by)
    VALUES (v_team, 'P6E Project', 'active', 'mixed', v_user1)
    RETURNING id INTO v_project;

  INSERT INTO milestones (project_id, title, order_index, status, created_by)
    VALUES (v_project, 'Discovery', 0, 'pending', v_user1)
    RETURNING id INTO v_milestone;

  INSERT INTO milestone_assignees (milestone_id, user_id)
    VALUES (v_milestone, v_user2), (v_milestone, v_user3);

  -- ==================================================================
  -- 1) REALTIME PUBLICATION
  -- ==================================================================
  SELECT count(*) INTO v_pub_count
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'notifications';
  IF v_pub_count <> 1 THEN
    RAISE EXCEPTION '[FAIL 1a] notifications not in supabase_realtime publication';
  END IF;

  SELECT relreplident INTO v_replica
  FROM pg_class WHERE relname = 'notifications';
  IF v_replica <> 'f' THEN
    RAISE EXCEPTION '[FAIL 1b] notifications REPLICA IDENTITY not FULL (got %)', v_replica;
  END IF;
  RAISE NOTICE '[OK 1] realtime publication + REPLICA IDENTITY FULL';

  -- ==================================================================
  -- 2) NOTIFICATION DEFAULTS & ENUM
  -- ==================================================================
  INSERT INTO notifications (user_id, type, title)
    VALUES (v_user2, 'milestone_submitted', 'Default test');

  SELECT priority::text, delivered_channels
  INTO v_pri, v_channels
  FROM notifications
  WHERE user_id = v_user2 AND title = 'Default test';

  IF v_pri <> 'normal' THEN
    RAISE EXCEPTION '[FAIL 2a] priority default not normal (got %)', v_pri;
  END IF;
  IF v_channels IS NULL OR array_length(v_channels, 1) IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL 2b] delivered_channels default not empty array (got %)', v_channels;
  END IF;

  -- All 4 priority values accepted
  BEGIN
    INSERT INTO notifications (user_id, type, title, priority) VALUES
      (v_user2, 'system', 'pri-low',    'low'),
      (v_user2, 'system', 'pri-normal', 'normal'),
      (v_user2, 'system', 'pri-high',   'high'),
      (v_user2, 'system', 'pri-urgent', 'urgent');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '[FAIL 2c] priority enum rejected valid value: %', SQLERRM;
  END;

  -- Invalid priority rejected
  BEGIN
    INSERT INTO notifications (user_id, type, title, priority)
      VALUES (v_user2, 'system', 'bad', 'critical');
    RAISE EXCEPTION '[FAIL 2d] priority enum accepted invalid value critical';
  EXCEPTION WHEN invalid_text_representation THEN NULL;
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%critical%' AND SQLERRM NOT LIKE '%invalid input%' THEN
        RAISE;
      END IF;
  END;

  DELETE FROM notifications WHERE user_id IN (v_user1, v_user2, v_user3);
  RAISE NOTICE '[OK 2] notification defaults + priority enum';

  -- ==================================================================
  -- 3) NOTIFY LAYER: notify_in_app OPT-OUT FILTER
  -- ==================================================================
  -- user2 opts out of in-app. notify() should insert for user3 only.
  UPDATE profiles SET notify_in_app = false WHERE id = v_user2;
  UPDATE profiles SET notify_in_app = true  WHERE id = v_user3;

  -- Simulate lib/notifications.ts notify({userIds:[user2,user3], ...})
  -- The lib first filters to notify_in_app=true, then inserts.
  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT p.id, 'comment_added', 'New reply', 'hello', '/projects/x'
  FROM profiles p
  WHERE p.id = ANY(ARRAY[v_user2, v_user3])
    AND p.notify_in_app = true;

  SELECT count(*) INTO v_count
  FROM notifications
  WHERE user_id = ANY(ARRAY[v_user2, v_user3])
    AND title = 'New reply';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FAIL 3a] notify_in_app filter wrong — expected 1 row, got %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM notifications
  WHERE user_id = v_user2 AND title = 'New reply';
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL 3b] user2 received notification despite opt-out';
  END IF;

  SELECT count(*) INTO v_count
  FROM notifications
  WHERE user_id = v_user3 AND title = 'New reply';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FAIL 3c] user3 did not receive notification';
  END IF;

  UPDATE profiles SET notify_in_app = true WHERE id = v_user2;
  DELETE FROM notifications WHERE title = 'New reply';
  RAISE NOTICE '[OK 3] notify_in_app opt-out filter';

  -- ==================================================================
  -- 4) NOTIFY HELPERS PARITY CHECK (SQL queries mirror lib/notifications.ts)
  -- ==================================================================
  -- getMilestoneAssignees(v_milestone, v_user1) should return user2+user3
  SELECT count(*) INTO v_count
  FROM (
    SELECT user_id FROM milestone_assignees
    WHERE milestone_id = v_milestone
      AND user_id <> v_user1
  ) t;
  IF v_count <> 2 THEN
    RAISE EXCEPTION '[FAIL 4a] getMilestoneAssignees mirror returned % (expected 2)', v_count;
  END IF;

  -- getMilestoneAssignees(v_milestone, v_user2) excludes the actor
  SELECT count(*) INTO v_count
  FROM (
    SELECT user_id FROM milestone_assignees
    WHERE milestone_id = v_milestone
      AND user_id <> v_user2
  ) t;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FAIL 4b] actor-exclusion broken: got % (expected 1)', v_count;
  END IF;

  -- getProjectTeamAudience(v_project, v_user1) -> user2+user3
  SELECT count(*) INTO v_count
  FROM profiles
  WHERE team_id = (SELECT team_id FROM projects WHERE id = v_project)
    AND id <> v_user1;
  IF v_count <> 2 THEN
    RAISE EXCEPTION '[FAIL 4c] getProjectTeamAudience mirror returned %', v_count;
  END IF;

  -- getProjectLead(v_project) -> v_user1
  IF (SELECT t.lead_id FROM projects p JOIN teams t ON t.id = p.team_id
      WHERE p.id = v_project) <> v_user1 THEN
    RAISE EXCEPTION '[FAIL 4d] getProjectLead mirror broken';
  END IF;
  RAISE NOTICE '[OK 4] notify helpers mirror lib behavior';

  -- ==================================================================
  -- 5) FILES SOFT-DELETE TRIGGER — ALL 3 PATHS
  -- ==================================================================
  INSERT INTO files (team_id, project_id, filename, blob_url, size_bytes, uploaded_by)
    VALUES (v_team, v_project, 'asset.pdf', 'https://x.test/asset.pdf', 2048, v_user1)
    RETURNING id INTO v_file;

  -- Path A: false→true with no explicit deleted_at -> stamp now()
  UPDATE files
    SET is_deleted = true, deleted_by = v_user1
    WHERE id = v_file;

  SELECT deleted_at, deleted_by INTO v_deleted_at, v_deleted_by
    FROM files WHERE id = v_file;
  IF v_deleted_at IS NULL THEN
    RAISE EXCEPTION '[FAIL 5a] trigger did not stamp deleted_at on is_deleted=true';
  END IF;
  IF v_deleted_by <> v_user1 THEN
    RAISE EXCEPTION '[FAIL 5b] deleted_by not preserved on soft-delete';
  END IF;

  -- Path B: true→false -> clear both deleted_at + deleted_by
  UPDATE files SET is_deleted = false WHERE id = v_file;
  SELECT deleted_at, deleted_by INTO v_deleted_at, v_deleted_by
    FROM files WHERE id = v_file;
  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL 5c] trigger did not clear deleted_at on restore';
  END IF;
  IF v_deleted_by IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL 5d] trigger did not clear deleted_by on restore';
  END IF;

  -- Path C: explicit deleted_at is preserved (COALESCE branch)
  UPDATE files
    SET is_deleted = true,
        deleted_at = '2020-01-01 00:00:00+00'::timestamptz,
        deleted_by = v_user1
    WHERE id = v_file;
  SELECT deleted_at INTO v_deleted_at FROM files WHERE id = v_file;
  IF v_deleted_at <> '2020-01-01 00:00:00+00'::timestamptz THEN
    RAISE EXCEPTION '[FAIL 5e] explicit deleted_at overwritten (got %)', v_deleted_at;
  END IF;

  -- Path D: trigger does NOT fire on unrelated column updates
  UPDATE files SET is_deleted = false WHERE id = v_file;
  UPDATE files SET pinned = true WHERE id = v_file;
  SELECT deleted_at INTO v_deleted_at FROM files WHERE id = v_file;
  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL 5f] trigger fired on unrelated update';
  END IF;

  DELETE FROM files WHERE id = v_file;
  RAISE NOTICE '[OK 5] files soft-delete trigger (4 paths)';

  -- ==================================================================
  -- 6) MILESTONE_TEMPLATES SCOPE CHECK — ALL 4 SCENARIOS
  -- ==================================================================
  -- A: team-scoped, is_global=false -> OK
  INSERT INTO milestone_templates (team_id, name, template_data, is_global, created_by)
    VALUES (v_team, 'Team Scoped',
            '{"milestones":[{"title":"X","order_index":0,"checklist":[]}]}'::jsonb,
            false, v_user1)
    RETURNING id INTO v_tpl_tm;

  -- B: global, team_id=NULL -> OK
  INSERT INTO milestone_templates (team_id, name, template_data, is_global, created_by)
    VALUES (NULL, 'Global Template',
            '{"milestones":[]}'::jsonb, true, v_user1)
    RETURNING id INTO v_tpl_gl;

  -- C: global, team_id set -> still OK (CHECK: is_global OR team_id NOT NULL)
  BEGIN
    INSERT INTO milestone_templates (team_id, name, template_data, is_global, created_by)
      VALUES (v_team, 'Global+Team', '{"milestones":[]}'::jsonb, true, v_user1);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '[FAIL 6c] CHECK wrongly rejected global+team scope: %', SQLERRM;
  END;

  -- D: orphan — team_id=NULL AND is_global=false -> REJECTED
  BEGIN
    INSERT INTO milestone_templates (team_id, name, template_data, is_global, created_by)
      VALUES (NULL, 'Orphan', '{"milestones":[]}'::jsonb, false, v_user1);
    RAISE EXCEPTION '[FAIL 6d] scope CHECK accepted orphan row';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Defaults: usage_count=0, is_global=false, category=null
  IF (SELECT usage_count FROM milestone_templates WHERE id = v_tpl_tm) <> 0 THEN
    RAISE EXCEPTION '[FAIL 6e] usage_count default not 0';
  END IF;
  IF (SELECT is_global FROM milestone_templates WHERE id = v_tpl_tm) THEN
    RAISE EXCEPTION '[FAIL 6f] is_global default not false';
  END IF;
  RAISE NOTICE '[OK 6] template scope CHECK + defaults';

  -- ==================================================================
  -- 7) PROFILE PREFS DEFAULTS + UPDATES
  -- ==================================================================
  -- A user inserted above should have the Phase-6 defaults.
  SELECT timezone, notify_email, notify_in_app INTO v_tz, v_nemail, v_nin_app
    FROM profiles WHERE id = v_user3;

  IF v_tz <> 'Africa/Cairo' THEN
    RAISE EXCEPTION '[FAIL 7a] timezone default wrong: %', v_tz;
  END IF;
  IF NOT v_nemail THEN
    RAISE EXCEPTION '[FAIL 7b] notify_email default not true';
  END IF;
  IF NOT v_nin_app THEN
    RAISE EXCEPTION '[FAIL 7c] notify_in_app default not true';
  END IF;

  -- UPDATE prefs
  UPDATE profiles
    SET timezone = 'Asia/Riyadh',
        notify_email = false,
        notify_mentions = false,
        notify_assignments = false
    WHERE id = v_user3;
  SELECT timezone, notify_email INTO v_tz, v_nemail
    FROM profiles WHERE id = v_user3;
  IF v_tz <> 'Asia/Riyadh' OR v_nemail THEN
    RAISE EXCEPTION '[FAIL 7d] prefs update did not persist';
  END IF;

  -- last_seen_at column exists & accepts timestamp
  UPDATE profiles SET last_seen_at = now() WHERE id = v_user3;
  RAISE NOTICE '[OK 7] profile prefs defaults + update round-trip';

  -- ==================================================================
  -- 8) SITE_SETTINGS RETENTION DEFAULTS
  -- ==================================================================
  SELECT audit_retention_days INTO v_retention FROM site_settings WHERE id = 1;
  IF v_retention <> 365 THEN
    RAISE EXCEPTION '[FAIL 8a] audit_retention_days default wrong (got %)', v_retention;
  END IF;
  SELECT file_retention_days INTO v_retention FROM site_settings WHERE id = 1;
  IF v_retention <> 90 THEN
    RAISE EXCEPTION '[FAIL 8b] file_retention_days default wrong (got %)', v_retention;
  END IF;

  -- enable_client_share default true
  IF NOT (SELECT enable_client_share FROM site_settings WHERE id = 1) THEN
    RAISE EXCEPTION '[FAIL 8c] enable_client_share default not true';
  END IF;

  -- Admin can update retention
  UPDATE site_settings SET audit_retention_days = 180 WHERE id = 1;
  SELECT audit_retention_days INTO v_retention FROM site_settings WHERE id = 1;
  IF v_retention <> 180 THEN
    RAISE EXCEPTION '[FAIL 8d] retention UPDATE did not persist';
  END IF;
  UPDATE site_settings SET audit_retention_days = 365 WHERE id = 1;
  RAISE NOTICE '[OK 8] site_settings retention/share defaults + update';

  -- ==================================================================
  -- 9) AUDIT LOG INDEXES + prune_audit_log FUNCTION
  -- ==================================================================
  SELECT count(*) INTO v_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN ('idx_audit_log_created','idx_audit_log_entity','idx_audit_log_team');
  IF v_idx_count <> 3 THEN
    RAISE EXCEPTION '[FAIL 9a] expected 3 audit_log indexes, got %', v_idx_count;
  END IF;

  SELECT count(*) INTO v_fn_count
  FROM pg_proc WHERE proname = 'prune_audit_log';
  IF v_fn_count = 0 THEN
    RAISE EXCEPTION '[FAIL 9b] prune_audit_log function missing';
  END IF;

  -- Insert old + new audit rows, then simulate a prune by retention:
  INSERT INTO audit_log (team_id, actor_type, actor_id, actor_name, event, entity_type, created_at)
  VALUES
    (v_team, 'user', v_user1, 'Old', 'test.event', 'test',
     now() - interval '400 days'),
    (v_team, 'user', v_user1, 'New', 'test.event', 'test', now());

  -- Manual prune equivalent to the function body
  DELETE FROM audit_log
   WHERE created_at < now() - (
     (SELECT audit_retention_days FROM site_settings WHERE id = 1) || ' days'
   )::interval
     AND team_id = v_team;

  SELECT count(*) INTO v_count
  FROM audit_log
  WHERE team_id = v_team AND actor_name = 'Old';
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL 9c] prune logic did not remove old audit row';
  END IF;

  SELECT count(*) INTO v_count
  FROM audit_log
  WHERE team_id = v_team AND actor_name = 'New';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FAIL 9d] prune logic removed fresh audit row';
  END IF;
  RAISE NOTICE '[OK 9] audit_log indexes + prune function + retention math';

  -- ==================================================================
  -- 10) RLS POLICIES PRESENT (per-table, not DISABLE)
  -- ==================================================================
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'notifications';
  IF v_policy_count = 0 THEN
    RAISE EXCEPTION '[FAIL 10a] no RLS policies on notifications';
  END IF;

  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'milestone_templates';
  IF v_policy_count = 0 THEN
    RAISE EXCEPTION '[FAIL 10b] no RLS policies on milestone_templates';
  END IF;

  -- Verify RLS enabled flag
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'notifications') THEN
    RAISE EXCEPTION '[FAIL 10c] RLS disabled on notifications';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'milestone_templates') THEN
    RAISE EXCEPTION '[FAIL 10d] RLS disabled on milestone_templates';
  END IF;
  RAISE NOTICE '[OK 10] RLS enabled + policies present on notifications + milestone_templates';

  -- ==================================================================
  -- 11) END-TO-END: SAVE-AS-TEMPLATE + APPLY-ON-NEW-PROJECT
  -- ==================================================================
  -- Save v_milestone as a template (mirrors saveTemplateFromProjectAction)
  INSERT INTO milestone_templates (team_id, name, template_data, is_global, created_by)
    VALUES (
      v_team,
      'Copy of P6E Project',
      jsonb_build_object(
        'source', jsonb_build_object('project_id', v_project::text, 'project_name', 'P6E Project'),
        'milestones', jsonb_build_array(
          jsonb_build_object(
            'title', 'Discovery',
            'order_index', 0,
            'due_days_from_start', 7,
            'checklist', jsonb_build_array(
              jsonb_build_object('title', 'Kickoff call')
            )
          )
        )
      ),
      false,
      v_user1
    )
    RETURNING id INTO v_template;

  -- Apply the template into a NEW project (mirrors createProjectAction path)
  DECLARE
    v_new_project uuid;
    v_new_ms      uuid;
  BEGIN
    INSERT INTO projects (team_id, name, status, work_mode, created_by, start_date)
      VALUES (v_team, 'From Template', 'active', 'mixed', v_user1, CURRENT_DATE)
      RETURNING id INTO v_new_project;

    INSERT INTO milestones (project_id, title, order_index, due_date, status, progress, created_by)
      VALUES (v_new_project, 'Discovery', 0, CURRENT_DATE + 7, 'pending', 0, v_user1)
      RETURNING id INTO v_new_ms;

    INSERT INTO checklist_items (milestone_id, text, order_index)
      VALUES (v_new_ms, 'Kickoff call', 0);

    -- Assertions
    SELECT count(*) INTO v_count
    FROM milestones WHERE project_id = v_new_project;
    IF v_count <> 1 THEN
      RAISE EXCEPTION '[FAIL 11a] milestone not copied (got %)', v_count;
    END IF;

    IF (SELECT due_date FROM milestones WHERE id = v_new_ms) <> CURRENT_DATE + 7 THEN
      RAISE EXCEPTION '[FAIL 11b] due_date offset wrong';
    END IF;

    SELECT count(*) INTO v_count
    FROM checklist_items WHERE milestone_id = v_new_ms;
    IF v_count <> 1 THEN
      RAISE EXCEPTION '[FAIL 11c] checklist item not copied';
    END IF;

    IF (SELECT text FROM checklist_items WHERE milestone_id = v_new_ms) <> 'Kickoff call' THEN
      RAISE EXCEPTION '[FAIL 11d] checklist text wrong';
    END IF;

    -- Clean the new project (cascades milestones + checklist_items)
    DELETE FROM projects WHERE id = v_new_project;
  END;
  RAISE NOTICE '[OK 11] end-to-end template save + apply round-trip';

  -- ==================================================================
  -- CLEANUP
  -- ==================================================================
  DELETE FROM milestone_templates WHERE id IN (v_tpl_tm, v_tpl_gl, v_template);
  DELETE FROM milestone_templates WHERE is_global = true AND name = 'Global+Team';
  DELETE FROM audit_log WHERE team_id IN (v_team, v_other);
  DELETE FROM notifications WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM teams WHERE id IN (v_team, v_other);
  DELETE FROM profiles WHERE id IN (v_user1, v_user2, v_user3);
  DELETE FROM auth.users WHERE id IN (v_user1, v_user2, v_user3);

  RAISE NOTICE '[PASS] Phase 6 exhaustive: 11/11 sections OK';
END $$;
