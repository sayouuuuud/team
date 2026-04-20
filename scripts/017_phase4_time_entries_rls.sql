-- 017_phase4_time_entries_rls.sql
-- Tighten RLS on time_entries so each user only sees/edits their own entries,
-- while team leads can see all entries in their team's projects.
-- Replaces the permissive "same team" ALL policy inherited from phase 1.

-- 1) Drop the inherited wide-open policy (if present). --------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_entries'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.time_entries', r.policyname);
  END LOOP;
END $$;

-- 2) SELECT: own entries OR team lead can see team entries ---------------------
CREATE POLICY time_entries_select
ON public.time_entries
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.project_in_my_team(project_id)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'team_lead'
    )
  )
);

-- 3) INSERT: must be for self and inside my team's project ---------------------
CREATE POLICY time_entries_insert
ON public.time_entries
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.project_in_my_team(project_id)
);

-- 4) UPDATE: only the owner can edit their own entries -------------------------
CREATE POLICY time_entries_update
ON public.time_entries
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5) DELETE: owner, or lead on team entries ------------------------------------
CREATE POLICY time_entries_delete
ON public.time_entries
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.project_in_my_team(project_id)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'team_lead'
    )
  )
);
