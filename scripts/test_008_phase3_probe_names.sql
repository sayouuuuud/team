-- Probe actual index + trigger names for Phase 3 collab tables
SELECT jsonb_build_object(
  'indexes', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', tablename,
      'index', indexname
    ) ORDER BY tablename, indexname)
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'doc_pages','comments','internal_messages','announcements',
        'changelog_entries','resources','internal_notes','goals'
      )
  ),
  'triggers', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', event_object_table,
      'trigger', trigger_name,
      'event', event_manipulation,
      'timing', action_timing
    ) ORDER BY event_object_table, trigger_name)
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table IN (
        'doc_pages','comments','internal_messages','announcements',
        'changelog_entries','resources','internal_notes','goals'
      )
  )
) AS phase3_objects;
