-- Phase 6 static verify: Notifications realtime, prefs, templates, audit
DO $$
DECLARE
  v_fail int := 0;
  v_msg text;
BEGIN
  -- 1. notifications in supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    v_fail := v_fail + 1;
    RAISE WARNING '[P6] notifications not in supabase_realtime publication';
  END IF;

  -- 2. profiles pref columns
  FOR v_msg IN
    SELECT c FROM unnest(ARRAY[
      'timezone','notify_in_app','notify_email','notify_mentions','notify_assignments','last_seen_at'
    ]) c
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name=v_msg
    ) THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[P6] profiles.% missing', v_msg;
    END IF;
  END LOOP;

  -- 3. notifications.priority / delivered_channels
  FOR v_msg IN
    SELECT c FROM unnest(ARRAY['priority','delivered_channels']) c
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='notifications' AND column_name=v_msg
    ) THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[P6] notifications.% missing', v_msg;
    END IF;
  END LOOP;

  -- 4. milestone_templates columns
  FOR v_msg IN
    SELECT c FROM unnest(ARRAY['category','is_global','usage_count','created_by']) c
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='milestone_templates' AND column_name=v_msg
    ) THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[P6] milestone_templates.% missing', v_msg;
    END IF;
  END LOOP;

  -- 5. files soft delete columns + trigger
  FOR v_msg IN
    SELECT c FROM unnest(ARRAY['deleted_at','deleted_by']) c
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='files' AND column_name=v_msg
    ) THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[P6] files.% missing', v_msg;
    END IF;
  END LOOP;

  -- 6. site_settings retention + share toggles
  FOR v_msg IN
    SELECT c FROM unnest(ARRAY[
      'audit_retention_days','file_retention_days','enable_client_share','default_notification_email'
    ]) c
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='site_settings' AND column_name=v_msg
    ) THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[P6] site_settings.% missing', v_msg;
    END IF;
  END LOOP;

  -- 7. audit_log indexes
  FOR v_msg IN
    SELECT c FROM unnest(ARRAY['audit_log_team_created_idx','audit_log_actor_created_idx']) c
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND tablename='audit_log' AND indexname=v_msg
    ) THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[P6] index % missing', v_msg;
    END IF;
  END LOOP;

  IF v_fail = 0 THEN
    RAISE NOTICE '[P6] ALL CHECKS PASSED';
  ELSE
    RAISE EXCEPTION '[P6] % check(s) failed', v_fail;
  END IF;
END $$;
