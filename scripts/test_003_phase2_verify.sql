-- ─────────────────────────────────────────────────────────────
-- Phase 2 verification — read-only
-- Confirms schema patches (files.storage_key, site_settings patch)
-- and that RLS policies cover the new code paths.
-- ─────────────────────────────────────────────────────────────

-- 1) files.storage_key and files.mime_type exist
SELECT
  'files_patch' AS test,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'files'
  AND column_name IN ('storage_key', 'mime_type')
ORDER BY column_name;

-- 2) site_settings patched columns exist
SELECT
  'site_settings_patch' AS test,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'site_settings'
  AND column_name IN ('signups_open', 'default_team_capacity', 'brand_name')
ORDER BY column_name;

-- 3) Indexes created by 006 patch
SELECT
  'phase2_indexes' AS test,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_files_project',
    'idx_files_pinned',
    'idx_milestones_project_order',
    'idx_checklist_milestone_order',
    'idx_projects_share_token'
  )
ORDER BY indexname;

-- 4) RLS is enabled on every Phase 2 table we touch
SELECT
  'rls_enabled' AS test,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'teams', 'profiles', 'team_invitations',
    'projects', 'milestones', 'checklist_items',
    'milestone_assignees', 'files', 'site_settings'
  )
ORDER BY c.relname;

-- 5) Per-table policy counts — should all be > 0
SELECT
  'policy_counts' AS test,
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'teams', 'profiles', 'team_invitations',
    'projects', 'milestones', 'checklist_items',
    'milestone_assignees', 'files', 'site_settings'
  )
GROUP BY tablename
ORDER BY tablename;

-- 6) Admin user + site_admin profile still intact
SELECT
  'site_admin' AS test,
  p.id,
  p.role,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'admin@test.com';

-- 7) enum values required by Phase 2 code paths
SELECT
  'project_status_enum' AS test,
  e.enumlabel
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'project_status'
ORDER BY e.enumsortorder;

SELECT
  'milestone_status_enum' AS test,
  e.enumlabel
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'milestone_status'
ORDER BY e.enumsortorder;
