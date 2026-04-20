-- test_017_all_phases_surface.sql
-- Quick surface check: are all 5 phases applied?
-- Read-only. Returns a single ordered result set.

WITH checks AS (
  -- PHASE 1
  SELECT 1 AS ord, 'P1' AS phase, 'core tables (teams,profiles,projects,milestones,checklist_items,files)' AS check_name,
    (SELECT COUNT(*)=6 FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name IN ('teams','profiles','projects','milestones','checklist_items','files')) AS pass
  UNION ALL
  SELECT 2, 'P1', 'site_settings row exists',
    (SELECT COUNT(*)>=1 FROM public.site_settings)
  UNION ALL
  -- PHASE 2
  SELECT 3, 'P2', 'admin tables (audit_log, admins)',
    (SELECT COUNT(*)=2 FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('audit_log','admins'))
  UNION ALL
  SELECT 4, 'P2', 'audit_log.event column',
    (SELECT COUNT(*)=1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='audit_log' AND column_name='event')
  UNION ALL
  -- PHASE 3
  SELECT 5, 'P3', 'collab tables (doc_pages,goals,changelog,announcements,resources,notes,messages,comments)',
    (SELECT COUNT(*)=8 FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name IN ('doc_pages','goals','changelog_entries','announcements',
                           'resources','internal_notes','internal_messages','comments'))
  UNION ALL
  SELECT 6, 'P3', 'comments.parent_id (threaded)',
    (SELECT COUNT(*)=1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='comments' AND column_name='parent_id')
  UNION ALL
  SELECT 7, 'P3', 'goals.progress CHECK 0..100 (migration 015)',
    (SELECT COUNT(*)>=1 FROM information_schema.check_constraints cc
       JOIN information_schema.constraint_column_usage ccu
         USING (constraint_schema, constraint_name)
      WHERE ccu.table_schema='public' AND ccu.table_name='goals' AND ccu.column_name='progress')
  UNION ALL
  SELECT 8, 'P3', 'touch_updated_at uses clock_timestamp (migration 016)',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='touch_updated_at' AND prosrc LIKE '%clock_timestamp%')
  UNION ALL
  SELECT 9, 'P3', 'realtime publication: internal_messages',
    (SELECT COUNT(*)>=1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND tablename='internal_messages')
  UNION ALL
  -- PHASE 4
  SELECT 10, 'P4', 'time_entries table',
    (SELECT COUNT(*)=1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='time_entries')
  UNION ALL
  SELECT 11, 'P4', 'milestones.board_order + approved_at',
    (SELECT COUNT(*)=2 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='milestones'
        AND column_name IN ('board_order','approved_at'))
  UNION ALL
  SELECT 12, 'P4', 'set_time_entry_duration() function',
    (SELECT COUNT(*)=1 FROM pg_proc WHERE proname='set_time_entry_duration')
  UNION ALL
  SELECT 13, 'P4', 'stamp_milestone_approval() function',
    (SELECT COUNT(*)=1 FROM pg_proc WHERE proname='stamp_milestone_approval')
  UNION ALL
  SELECT 14, 'P4', 'uq_time_entries_one_running_per_user index',
    (SELECT COUNT(*)=1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='uq_time_entries_one_running_per_user')
  UNION ALL
  SELECT 15, 'P4', 'time_entries has 4 per-op policies (migration 017)',
    (SELECT COUNT(*)=4 FROM pg_policies
      WHERE schemaname='public' AND tablename='time_entries')
  UNION ALL
  -- PHASE 5
  SELECT 16, 'P5', 'ai_usage table',
    (SELECT COUNT(*)=1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='ai_usage')
  UNION ALL
  SELECT 17, 'P5', 'projects autopilot cols (auto_status, predicted_end_date, last_activity_at)',
    (SELECT COUNT(*)=3 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='projects'
        AND column_name IN ('auto_status','predicted_end_date','last_activity_at'))
  UNION ALL
  SELECT 18, 'P5', 'milestones autopilot cols (auto_status, activity_score)',
    (SELECT COUNT(*)=2 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='milestones'
        AND column_name IN ('auto_status','activity_score'))
  UNION ALL
  SELECT 19, 'P5', 'autopilot enums (project_auto_status, milestone_auto_status)',
    (SELECT COUNT(*)=2 FROM pg_type
      WHERE typname IN ('project_auto_status','milestone_auto_status'))
  UNION ALL
  SELECT 20, 'P5', 'bump_project_activity uses clock_timestamp (migration 018)',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='bump_project_activity' AND prosrc LIKE '%clock_timestamp%')
  UNION ALL
  SELECT 21, 'P5', 'site_settings has ai_enabled + ai_daily_limit_per_team',
    (SELECT COUNT(*)=2 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='site_settings'
        AND column_name IN ('ai_enabled','ai_daily_limit_per_team'))
)
SELECT
  ord                                        AS "#",
  phase                                      AS "phase",
  CASE WHEN pass THEN 'PASS' ELSE 'FAIL' END AS "status",
  check_name                                 AS "check"
FROM checks
ORDER BY ord;
