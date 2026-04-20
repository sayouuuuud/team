-- Phase 6: publish notifications to supabase_realtime so the bell icon
-- can subscribe to INSERT/UPDATE and update the unread count live.
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- REPLICA IDENTITY FULL so UPDATE payloads (mark-as-read) include user_id
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

SELECT 'phase6_notifications_realtime_published' AS status;
