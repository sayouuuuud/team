-- test_017_all_phases_surface.sql
-- Quick surface check: are all 5 phases applied?
-- Read-only. Counts key tables, columns, enums, triggers per phase.

\echo '==================== PHASES APPLIED? ===================='

-- ============ PHASE 1: core tenancy ============
\echo ''
\echo '--- PHASE 1: core tables ---'
SELECT
  CASE WHEN COUNT(*) = 6 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) || '/6 core tables' AS detail
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('teams','profiles','projects','milestones','checklist_items','files');

-- site_settings row exists
SELECT
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'site_settings row' AS detail
FROM public.site_settings;

-- ============ PHASE 2: admin + audit ============
\echo ''
\echo '--- PHASE 2: admin + audit ---'
SELECT
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) || '/2 admin tables (audit_log, admins)' AS detail
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('audit_log','admins');

SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'audit_log.event column' AS detail
FROM information_schema.columns
WHERE table_schema='public' AND table_name='audit_log' AND column_name='event';

-- ============ PHASE 3: collab ============
\echo ''
\echo '--- PHASE 3: collab tables ---'
SELECT
  CASE WHEN COUNT(*) = 8 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) || '/8 collab tables' AS detail
FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('doc_pages','goals','changelog_entries','announcements',
   'resources','internal_notes','internal_messages','comments');

-- comments.parent_id (threaded)
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'comments.parent_id (threaded)' AS detail
FROM information_schema.columns
WHERE table_schema='public' AND table_name='comments' AND column_name='parent_id';

-- goals.progress CHECK (Phase 3 migration 015)
SELECT
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'goals.progress CHECK 0..100' AS detail
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
WHERE ccu.table_schema='public'
  AND ccu.table_name='goals'
  AND ccu.column_name='progress';

-- touch_updated_at uses clock_timestamp (migration 016)
SELECT
  CASE WHEN prosrc LIKE '%clock_timestamp%' THEN 'PASS' ELSE 'FAIL' END AS status,
  'touch_updated_at uses clock_timestamp' AS detail
FROM pg_proc
WHERE proname='touch_updated_at'
LIMIT 1;

-- Realtime publication includes internal_messages
SELECT
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'realtime pub: internal_messages' AS detail
FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename='internal_messages';

-- ============ PHASE 4: kanban + time ============
\echo ''
\echo '--- PHASE 4: kanban + time ---'
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'time_entries table' AS detail
FROM information_schema.tables
WHERE table_schema='public' AND table_name='time_entries';

SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'milestones.board_order' AS detail
FROM information_schema.columns
WHERE table_schema='public' AND table_name='milestones' AND column_name='board_order';

SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'milestones.approved_at' AS detail
FROM information_schema.columns
WHERE table_schema='public' AND table_name='milestones' AND column_name='approved_at';

-- set_time_entry_duration function
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'set_time_entry_duration()' AS detail
FROM pg_proc WHERE proname='set_time_entry_duration';

-- stamp_milestone_approval function
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'stamp_milestone_approval()' AS detail
FROM pg_proc WHERE proname='stamp_milestone_approval';

-- unique partial index (one running per user)
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'uq_time_entries_one_running_per_user' AS detail
FROM pg_indexes
WHERE schemaname='public' AND indexname='uq_time_entries_one_running_per_user';

-- time_entries has 4 per-op policies (migration 017)
SELECT
  CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) || '/4 time_entries policies (tight RLS)' AS detail
FROM pg_policies
WHERE schemaname='public' AND tablename='time_entries';

-- ============ PHASE 5: AI + autopilot ============
\echo ''
\echo '--- PHASE 5: AI + autopilot ---'
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  'ai_usage table' AS detail
FROM information_schema.tables
WHERE table_schema='public' AND table_name='ai_usage';

-- autopilot columns on projects
SELECT
  CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) || '/3 projects autopilot cols (auto_status, predicted_end_date, last_activity_at)' AS detail
FROM information_schema.columns
WHERE table_schema='public' AND table_name='projects'
  AND column_name IN ('auto_status','predicted_end_date','last_activity_at');

-- autopilot columns on milestones
SELECT
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) || '/2 milestones autopilot cols (auto_status, activity_score)' AS detail
FROM information_schema.columns
WHERE table_schema='public' AND table_name='milestones'
  AND column_name IN ('auto_status','activity_score');

-- autopilot enums
SELECT
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) || '/2 autopilot enums' AS detail
FROM pg_type
WHERE typname IN ('project_auto_status','milestone_auto_status');

-- bump_project_activity uses clock_timestamp (migration 018)
SELECT
  CASE WHEN prosrc LIKE '%clock_timestamp%' THEN 'PASS' ELSE 'FAIL' END AS status,
  'bump_project_activity uses clock_timestamp' AS detail
FROM pg_proc
WHERE proname='bump_project_activity'
LIMIT 1;

-- site_settings has AI toggles
SELECT
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) || '/2 site_settings AI cols' AS detail
FROM information_schema.columns
WHERE table_schema='public' AND table_name='site_settings'
  AND column_name IN ('ai_enabled','ai_daily_limit_per_team');

-- ============ SUMMARY ============
\echo ''
\echo '--- SUMMARY ---'
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS public_tables,
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public') AS public_functions,
  (SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal) AS user_triggers,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public') AS rls_policies;
