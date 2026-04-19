-- ============================================================
-- Phase 3 VERIFY: schema, indexes, enums, realtime, and triggers
-- required by the collab features (Docs, Goals, Changelog,
-- Announcements, Notes, Resources, Chat, Milestone comments).
-- Read-only; no writes, nothing to roll back.
-- ============================================================

-- ---- 1) Collab tables exist
SELECT 'P3_table_' || t AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name=t
       ) THEN 'OK' ELSE 'MISSING' END AS value
FROM unnest(ARRAY[
  'doc_pages', 'goals', 'changelog_entries', 'announcements',
  'resources', 'internal_notes', 'internal_messages', 'comments'
]) AS t;

-- ---- 2) Critical Phase-3 columns that the code depends on
WITH expected(table_name, column_name) AS (VALUES
  -- Comments (threaded + RLS + realtime)
  ('comments','parent_id'),
  ('comments','updated_at'),
  ('comments','content'),
  ('comments','author_type'),
  ('comments','author_name'),
  ('comments','is_internal'),
  -- Internal messages (edit + realtime)
  ('internal_messages','content'),
  ('internal_messages','edited_at'),
  ('internal_messages','updated_at'),
  -- Doc pages (wiki)
  ('doc_pages','content_markdown'),
  ('doc_pages','parent_id'),
  ('doc_pages','order_index'),
  ('doc_pages','last_edited_by'),
  -- Goals
  ('goals','kpi'),
  ('goals','progress'),
  ('goals','description'),
  -- Announcements
  ('announcements','content'),
  ('announcements','pinned'),
  -- Changelog
  ('changelog_entries','content'),
  ('changelog_entries','ai_generated'),
  ('changelog_entries','published_at'),
  -- Resources
  ('resources','type'),
  ('resources','content'),
  ('resources','blob_url'),
  ('resources','is_public'),
  ('resources','encrypted'),
  -- Internal notes
  ('internal_notes','content_markdown'),
  ('internal_notes','updated_at')
)
SELECT 'P3_col_' || e.table_name || '.' || e.column_name AS section,
       CASE WHEN c.column_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS value
FROM expected e
LEFT JOIN information_schema.columns c
       ON c.table_schema='public'
      AND c.table_name=e.table_name
      AND c.column_name=e.column_name
ORDER BY 1;

-- ---- 3) Enum values used by the code
SELECT 'P3_enum_author_kind' AS section,
       array_agg(enumlabel ORDER BY enumsortorder)::text AS value
FROM pg_enum
WHERE enumtypid = 'author_kind'::regtype;

SELECT 'P3_enum_resource_kind' AS section,
       array_agg(enumlabel ORDER BY enumsortorder)::text AS value
FROM pg_enum
WHERE enumtypid = 'resource_kind'::regtype;

-- ---- 4) Helpful indexes installed by 007_phase3_collab_patch.sql
WITH expected(name) AS (VALUES
  ('doc_pages_project_order_idx'),
  ('comments_milestone_created_idx'),
  ('comments_parent_idx'),
  ('internal_messages_project_created_idx'),
  ('announcements_project_pinned_idx'),
  ('changelog_project_published_idx'),
  ('resources_project_created_idx'),
  ('internal_notes_project_updated_idx'),
  ('goals_project_created_idx')
)
SELECT 'P3_idx_' || e.name AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname='public' AND indexname=e.name
       ) THEN 'OK' ELSE 'MISSING' END AS value
FROM expected e;

-- ---- 5) RLS is enabled on every collab table
WITH tables(name) AS (VALUES
  ('doc_pages'), ('goals'), ('changelog_entries'),
  ('announcements'), ('resources'), ('internal_notes'),
  ('internal_messages'), ('comments')
)
SELECT 'P3_rls_' || t.name AS section,
       CASE WHEN c.relrowsecurity THEN 'ON' ELSE 'OFF' END AS value
FROM tables t
JOIN pg_class c ON c.relname = t.name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname='public';

-- ---- 6) Number of RLS policies per table (sanity check)
SELECT 'P3_policies_' || tablename AS section,
       count(*)::text AS value
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN (
    'doc_pages','goals','changelog_entries','announcements',
    'resources','internal_notes','internal_messages','comments'
  )
GROUP BY tablename
ORDER BY 1;

-- ---- 7) Realtime publication includes the two live tables
SELECT 'P3_realtime_' || t AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime'
           AND schemaname='public'
           AND tablename=t
       ) THEN 'OK' ELSE 'MISSING' END AS value
FROM unnest(ARRAY['internal_messages','comments']) AS t;

-- ---- 8) REPLICA IDENTITY FULL on realtime tables
SELECT 'P3_replica_' || c.relname AS section,
       CASE c.relreplident
         WHEN 'f' THEN 'FULL'
         WHEN 'd' THEN 'DEFAULT'
         WHEN 'n' THEN 'NOTHING'
         WHEN 'i' THEN 'INDEX'
       END AS value
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('internal_messages','comments');

-- ---- 9) touch_updated_at triggers attached where we expect them
WITH expected(table_name) AS (VALUES
  ('doc_pages'), ('comments'), ('internal_messages'),
  ('internal_notes'), ('announcements'),
  ('goals'), ('resources'), ('changelog_entries')
)
SELECT 'P3_trig_touch_' || e.table_name AS section,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger tg
         JOIN pg_class c ON c.oid = tg.tgrelid
         WHERE c.relname = e.table_name
           AND tg.tgname LIKE 'trg_%_touch%'
           AND NOT tg.tgisinternal
       ) THEN 'OK' ELSE 'MISSING' END AS value
FROM expected e;
