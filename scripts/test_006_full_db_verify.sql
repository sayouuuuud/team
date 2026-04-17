-- ======================================================================
-- test_006_full_db_verify.sql
-- Read-only verification of the COMPLETE database (Phases 1 through 6)
-- ======================================================================

-- ---- 1) Table count (must be >= 22 Phase-1 tables, still present) ----
SELECT 'TABLES' AS section, COUNT(*)::text AS value
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- ---- 2) All expected tables present ----
WITH expected (name) AS (VALUES
  ('teams'), ('profiles'), ('team_invitations'),
  ('projects'), ('milestones'), ('milestone_assignees'), ('checklist_items'),
  ('files'), ('comments'), ('internal_messages'),
  ('doc_pages'), ('goals'), ('announcements'), ('changelog_entries'),
  ('resources'), ('internal_notes'), ('time_entries'),
  ('notifications'), ('audit_log'), ('ai_usage'),
  ('milestone_templates'), ('site_settings')
)
SELECT 'MISSING_TABLES' AS section, COALESCE(string_agg(e.name, ', '), 'none') AS value
FROM expected e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.name
WHERE t.table_name IS NULL;

-- ---- 3) Phase 2 columns ----
SELECT 'P2_files_storage_key' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='files' AND column_name='storage_key'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P2_files_mime_type' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='files' AND column_name='mime_type'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

-- ---- 4) Phase 3 columns ----
SELECT 'P3_doc_pages_order_index' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='doc_pages' AND column_name='order_index'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P3_comments_parent_id' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='comments' AND column_name='parent_id'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P3_internal_messages_edited_at' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='internal_messages' AND column_name='edited_at'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

-- ---- 5) Phase 4 columns + unique running-timer ----
SELECT 'P4_milestones_board_order' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='milestones' AND column_name='board_order'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P4_milestones_approved_at' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='milestones' AND column_name='approved_at'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P4_time_entries_one_running_idx' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE tablename='time_entries'
           AND indexname='time_entries_one_running_per_user_idx'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

-- ---- 6) Phase 5 enums + columns ----
SELECT 'P5_enum_project_auto_status' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname='project_auto_status'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P5_projects_auto_status' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='projects' AND column_name='auto_status'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P5_projects_predicted_end_date' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='projects' AND column_name='predicted_end_date'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P5_projects_last_activity_at' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='projects' AND column_name='last_activity_at'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

-- ---- 7) Phase 6 columns ----
SELECT 'P6_profiles_timezone' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='profiles' AND column_name='timezone'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P6_profiles_notifications_email' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='profiles' AND column_name='notifications_email'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P6_files_deleted_at' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='files' AND column_name='deleted_at'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P6_notifications_priority' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='notifications' AND column_name='priority'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

SELECT 'P6_site_settings_file_retention_days' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='site_settings' AND column_name='file_retention_days'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

-- ---- 8) Functions present ----
SELECT 'FUNCTIONS' AS section,
       string_agg(p.proname, ', ' ORDER BY p.proname) AS value
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'touch_updated_at',
    'sync_milestone_progress',
    'recompute_project_auto_status',
    'prune_soft_deleted_files',
    'prune_audit_log',
    'prune_expired_invitations',
    'prevent_lead_demotion',
    'compute_time_entry_duration',
    'bump_project_activity',
    'bump_milestone_approved_at',
    'stamp_file_deleted_at'
  );

-- ---- 9) Triggers count per hot table ----
SELECT 'TRIGGERS_milestones' AS section, COUNT(*)::text AS value
FROM information_schema.triggers
WHERE event_object_table = 'milestones';

SELECT 'TRIGGERS_checklist_items' AS section, COUNT(*)::text AS value
FROM information_schema.triggers
WHERE event_object_table = 'checklist_items';

SELECT 'TRIGGERS_files' AS section, COUNT(*)::text AS value
FROM information_schema.triggers
WHERE event_object_table = 'files';

SELECT 'TRIGGERS_time_entries' AS section, COUNT(*)::text AS value
FROM information_schema.triggers
WHERE event_object_table = 'time_entries';

SELECT 'TRIGGERS_profiles' AS section, COUNT(*)::text AS value
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- ---- 10) RLS still enabled on every Phase-1 table ----
SELECT 'RLS_DISABLED_TABLES' AS section,
       COALESCE(string_agg(c.relname, ', '), 'none') AS value
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false
  AND c.relname IN (
    'teams','profiles','team_invitations','projects','milestones',
    'milestone_assignees','checklist_items','files','comments',
    'internal_messages','doc_pages','goals','announcements',
    'changelog_entries','resources','internal_notes','time_entries',
    'notifications','audit_log','ai_usage','milestone_templates','site_settings'
  );

-- ---- 11) Site admin intact ----
SELECT 'SITE_ADMIN' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM profiles p
         JOIN auth.users u ON u.id = p.id
         WHERE u.email = 'admin@test.com' AND p.role = 'site_admin'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

-- ---- 12) Site settings singleton present ----
SELECT 'SITE_SETTINGS' AS section,
       brand_name || ' / signups=' || signups_open::text ||
       ' / cap=' || default_team_capacity::text AS value
FROM site_settings WHERE id = 1;

-- ---- 13) Live function smoke test: sync_milestone_progress works end-to-end
-- Creates a real auth.users row first (satisfying profiles_id_fkey), runs the
-- check, then raises 'rollback_smoke' to force a clean rollback so nothing
-- persists in auth.users or any public table.
DO $$
DECLARE
  v_team uuid := gen_random_uuid();
  v_lead uuid := gen_random_uuid();
  v_proj uuid := gen_random_uuid();
  v_mile uuid := gen_random_uuid();
  v_progress int;
BEGIN
  -- Minimal auth.users row so the profiles FK is happy.
  INSERT INTO auth.users (id, instance_id, email, aud, role)
    VALUES (
      v_lead,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'smoke-' || v_lead::text || '@test.local',
      'authenticated',
      'authenticated'
    );

  INSERT INTO teams (id, name, join_code, lead_id)
    VALUES (v_team, 'SmokeTeam', 'SMOKE6', NULL);
  INSERT INTO profiles (id, full_name, role, team_id)
    VALUES (v_lead, 'Smoke Lead', 'team_lead', v_team);
  UPDATE teams SET lead_id = v_lead WHERE id = v_team;

  INSERT INTO projects (id, team_id, name, created_by)
    VALUES (v_proj, v_team, 'Smoke Project', v_lead);

  INSERT INTO milestones (id, project_id, title, created_by, order_index)
    VALUES (v_mile, v_proj, 'Smoke Milestone', v_lead, 0);

  -- Insert 4 items, tick 2 of them -> expect progress = 50
  INSERT INTO checklist_items (milestone_id, text, order_index)
    VALUES (v_mile, 'a', 0), (v_mile, 'b', 1), (v_mile, 'c', 2), (v_mile, 'd', 3);

  UPDATE checklist_items SET is_done = true
    WHERE milestone_id = v_mile
      AND text IN ('a','b');

  SELECT progress INTO v_progress FROM milestones WHERE id = v_mile;
  IF v_progress <> 50 THEN
    RAISE EXCEPTION '[SMOKE FAIL] expected progress=50, got %', v_progress;
  END IF;
  RAISE NOTICE '[SMOKE OK] sync_milestone_progress -> 50%%';

  -- Force rollback so nothing persists.
  RAISE EXCEPTION 'rollback_smoke';
END $$;
