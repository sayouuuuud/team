-- =========================================================================
-- 013_add_updated_at_columns.sql
-- Adds `updated_at` to tables that were missing it so that:
--   - The touch_updated_at trigger from 011 attaches to them.
--   - sync_milestone_progress() and recompute_project_auto_status() can
--     write/read updated_at without errors.
-- Additive, idempotent.
-- =========================================================================

-- 1) milestones
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) checklist_items
ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) files
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 4) team_invitations
ALTER TABLE team_invitations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 5) comments
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 6) internal_messages
ALTER TABLE internal_messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 7) goals
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 8) announcements
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 9) resources
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 10) internal_notes
ALTER TABLE internal_notes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 11) notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 12) changelog_entries
ALTER TABLE changelog_entries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 13) time_entries
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 14) milestone_templates
ALTER TABLE milestone_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Re-attach the generic touch_updated_at trigger to every table that now has
-- an updated_at column (idempotent; drops-then-creates per table).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.%I;', t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_touch_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t
    );
  END LOOP;
END $$;
