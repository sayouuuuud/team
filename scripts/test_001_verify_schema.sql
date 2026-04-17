-- ============================================================================
-- Phase 1 Test: Verify schema, RLS, and seed data
-- ============================================================================

-- 1) Check all 22 expected tables exist
WITH expected AS (
  SELECT unnest(ARRAY[
    'teams','profiles','team_invitations','projects','milestones',
    'milestone_assignees','checklist_items','files','comments','internal_messages',
    'doc_pages','goals','announcements','changelog_entries','resources',
    'internal_notes','time_entries','notifications','audit_log','ai_usage',
    'milestone_templates','site_settings'
  ]) AS table_name
),
present AS (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
)
SELECT
  'TABLES_CHECK' AS test,
  (SELECT count(*) FROM expected) AS expected_count,
  (SELECT count(*) FROM expected e WHERE e.table_name IN (SELECT table_name FROM present)) AS present_count,
  (SELECT string_agg(e.table_name, ', ')
     FROM expected e
     WHERE e.table_name NOT IN (SELECT table_name FROM present)) AS missing_tables;

-- 2) Check RLS is enabled on all phase 1 tables
SELECT
  'RLS_CHECK' AS test,
  count(*) FILTER (WHERE rowsecurity = true) AS rls_enabled_count,
  count(*) AS total_count,
  string_agg(CASE WHEN rowsecurity = false THEN tablename END, ', ') AS tables_without_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'teams','profiles','team_invitations','projects','milestones',
    'milestone_assignees','checklist_items','files','comments','internal_messages',
    'doc_pages','goals','announcements','changelog_entries','resources',
    'internal_notes','time_entries','notifications','audit_log','ai_usage',
    'milestone_templates','site_settings'
  );

-- 3) Count policies per table
SELECT
  'POLICY_COUNT' AS test,
  tablename,
  count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 4) Check site_settings singleton seeded
SELECT
  'SITE_SETTINGS_SEED' AS test,
  id,
  brand_name,
  signups_open,
  default_team_capacity,
  default_max_files,
  max_file_size_mb,
  invitation_ttl_days,
  ai_enabled,
  ai_daily_limit_per_team
FROM site_settings
WHERE id = 1;

-- 5) Check site admin user exists
SELECT
  'ADMIN_AUTH_USER' AS test,
  id,
  email,
  email_confirmed_at IS NOT NULL AS email_confirmed,
  raw_app_meta_data->>'provider' AS provider
FROM auth.users
WHERE email = 'admin@test.com';

-- 6) Check site admin profile exists with correct role
SELECT
  'ADMIN_PROFILE' AS test,
  id,
  role,
  full_name,
  team_id
FROM profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@test.com');

-- 7) Check enums exist
SELECT
  'ENUMS_CHECK' AS test,
  t.typname AS enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('user_role','project_status','milestone_status','priority_level','notification_type')
GROUP BY t.typname
ORDER BY t.typname;

-- 8) Check critical foreign keys exist
SELECT
  'FK_CHECK' AS test,
  count(*) AS fk_count
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND constraint_type = 'FOREIGN KEY';
