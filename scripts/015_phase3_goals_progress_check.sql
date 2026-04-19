-- =========================================================================
-- 015_phase3_goals_progress_check.sql
-- Harden goals.progress: enforce 0..100 range in the database, matching the
-- UI clamp. Also back-fill any out-of-range rows before adding the check so
-- the migration is safe on existing data. Idempotent.
-- =========================================================================

-- Clamp any existing stray values (there shouldn't be any, but be safe).
UPDATE goals SET progress = 0   WHERE progress < 0;
UPDATE goals SET progress = 100 WHERE progress > 100;

-- Add a named CHECK constraint only if it doesn't already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'goals'
      AND c.conname = 'goals_progress_range'
  ) THEN
    EXECUTE 'ALTER TABLE goals
             ADD CONSTRAINT goals_progress_range
             CHECK (progress BETWEEN 0 AND 100)';
  END IF;
END $$;
