-- =====================================================================
-- test_012_phase5_verify.sql
-- Static Phase 5 audit: AI + Autopilot columns, triggers, indexes, RLS.
-- Read-only. Safe to run any time.
-- =====================================================================

-- 1) Autopilot columns on projects
WITH req AS (
  SELECT unnest(ARRAY['auto_status','predicted_end_date','last_activity_at']) AS col
)
SELECT
  'P5_projects_autopilot_cols' AS section,
  req.col AS check_name,
  CASE WHEN ic.column_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS result
FROM req
LEFT JOIN information_schema.columns ic
  ON ic.table_schema='public' AND ic.table_name='projects' AND ic.column_name=req.col;

-- 2) Autopilot columns on milestones
WITH req AS (
  SELECT unnest(ARRAY['auto_status','activity_score']) AS col
)
SELECT
  'P5_milestones_autopilot_cols' AS section,
  req.col AS check_name,
  CASE WHEN ic.column_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS result
FROM req
LEFT JOIN information_schema.columns ic
  ON ic.table_schema='public' AND ic.table_name='milestones' AND ic.column_name=req.col;

-- 3) Enums
SELECT
  'P5_enums' AS section,
  t.typname AS check_name,
  'OK' AS result
FROM pg_type t
WHERE t.typname IN ('project_auto_status','milestone_auto_status')
ORDER BY t.typname;

-- 4) Triggers bumping project activity
WITH req AS (
  SELECT unnest(ARRAY[
    'trg_bump_activity_milestones',
    'trg_bump_activity_checklist',
    'trg_bump_activity_files',
    'trg_bump_activity_comments'
  ]) AS trig
)
SELECT
  'P5_activity_triggers' AS section,
  req.trig AS check_name,
  CASE WHEN tg.tgname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS result
FROM req
LEFT JOIN pg_trigger tg ON tg.tgname = req.trig;

-- 5) ai_usage indexes (team+time, user+time)
WITH req AS (
  SELECT unnest(ARRAY['idx_ai_usage_team_time','idx_ai_usage_user_time']) AS idx
)
SELECT
  'P5_ai_usage_indexes' AS section,
  req.idx AS check_name,
  CASE WHEN ci.indexname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS result
FROM req
LEFT JOIN pg_indexes ci ON ci.indexname = req.idx AND ci.schemaname='public';

-- 6) ai_usage: RLS on + rows are only inserted server-side (service role).
--    We verify RLS is on; actual write access is via service client in app code.
SELECT
  'P5_ai_usage_rls' AS section,
  'rls_enabled' AS check_name,
  CASE WHEN c.relrowsecurity THEN 'OK' ELSE 'DISABLED' END AS result
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname='ai_usage';

-- 7) site_settings: ai_enabled + ai_daily_limit_per_team exist and are populated
SELECT
  'P5_site_settings_ai' AS section,
  'row_present' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM site_settings WHERE id=1
  ) THEN 'OK' ELSE 'MISSING' END AS result
UNION ALL
SELECT
  'P5_site_settings_ai',
  'ai_enabled_col',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='site_settings' AND column_name='ai_enabled'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT
  'P5_site_settings_ai',
  'ai_daily_limit_col',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='site_settings' AND column_name='ai_daily_limit_per_team'
  ) THEN 'OK' ELSE 'MISSING' END;
