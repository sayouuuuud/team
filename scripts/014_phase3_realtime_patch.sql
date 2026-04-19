-- Phase 3 realtime: publish internal_messages + comments so clients can
-- subscribe to INSERT/UPDATE/DELETE events via supabase_realtime.
-- Idempotent.

DO $$
BEGIN
  -- internal_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'internal_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages';
  END IF;

  -- comments (for milestone comments live updates)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.comments';
  END IF;
END $$;

-- Ensure REPLICA IDENTITY FULL so UPDATE/DELETE payloads include row data
ALTER TABLE public.internal_messages REPLICA IDENTITY FULL;
ALTER TABLE public.comments          REPLICA IDENTITY FULL;

SELECT 'phase3_realtime_published' AS status;
