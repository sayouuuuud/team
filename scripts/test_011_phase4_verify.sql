-- ============================================================================
-- Phase 4 static verification — Kanban + Time tracking schema pieces
-- Read-only.
-- ============================================================================

-- Columns we need
SELECT 'P4_milestones_board_order' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='milestones' AND column_name='board_order'
       ) THEN 'OK' ELSE 'MISSING' END AS value
UNION ALL
SELECT 'P4_milestones_approved_at',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='milestones' AND column_name='approved_at'
       ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'P4_time_entries_table',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name='time_entries'
       ) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'P4_time_entries_duration_seconds',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='time_entries' AND column_name='duration_seconds'
       ) THEN 'OK' ELSE 'MISSING' END;

-- Functions
SELECT 'FN_' || proname AS section, 'OK' AS value
FROM pg_proc
WHERE proname IN ('set_time_entry_duration', 'stamp_milestone_approval')
ORDER BY proname;

-- Triggers on milestones + time_entries
SELECT 'TRG_' || tgname AS section, 'OK' AS value
FROM pg_trigger
WHERE tgname IN (
  'trg_milestones_approved_stamp',
  'trg_time_entries_duration'
)
ORDER BY tgname;

-- The critical unique partial index (one running timer per user)
SELECT 'IDX_uq_time_entries_one_running_per_user' AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE indexname = 'uq_time_entries_one_running_per_user'
       ) THEN 'OK' ELSE 'MISSING' END AS value;

-- RLS on time_entries
SELECT 'RLS_time_entries' AS section,
       CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE relname='time_entries')
            THEN 'OK' ELSE 'OFF' END AS value;

SELECT 'POLICIES_time_entries' AS section, COUNT(*)::text AS value
FROM pg_policies WHERE tablename='time_entries';
