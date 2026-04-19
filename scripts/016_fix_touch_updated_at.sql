-- =========================================================================
-- 016_fix_touch_updated_at.sql
-- Replace NOW() (aka transaction_timestamp) with clock_timestamp() inside
-- the generic touch_updated_at() trigger so updated_at reflects the actual
-- moment of UPDATE even when multiple statements share one transaction.
-- Idempotent; no data changes.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
