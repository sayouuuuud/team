-- ─────────────────────────────────────────────────────────────
-- Phase 1 — Row Level Security policies
-- Site Admin: full access. Lead/Member: their team only.
-- Service role bypasses all of this (used by server actions).
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- Helper functions (SECURITY DEFINER to avoid recursion in profiles RLS)

CREATE OR REPLACE FUNCTION public.current_team_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT team_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_site_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'site_admin')
$$;

CREATE OR REPLACE FUNCTION public.project_in_my_team(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_id
      AND (p.team_id = public.current_team_id() OR public.is_site_admin())
  )
$$;

-- Enable RLS on every Phase-1 table ---------------------------
ALTER TABLE teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE files              ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_pages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage           ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings      ENABLE ROW LEVEL SECURITY;

-- PROFILES -----------------------------------------------------
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_site_admin()
    OR (team_id IS NOT NULL AND team_id = public.current_team_id())
  );

DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_site_admin())
  WITH CHECK (id = auth.uid() OR public.is_site_admin());

-- TEAMS --------------------------------------------------------
DROP POLICY IF EXISTS teams_select ON teams;
CREATE POLICY teams_select ON teams FOR SELECT TO authenticated
  USING (id = public.current_team_id() OR public.is_site_admin());

DROP POLICY IF EXISTS teams_update ON teams;
CREATE POLICY teams_update ON teams FOR UPDATE TO authenticated
  USING (lead_id = auth.uid() OR public.is_site_admin())
  WITH CHECK (lead_id = auth.uid() OR public.is_site_admin());

-- Also allow anyone authenticated to look up a team by join_code
-- (join flow). No INSERT policy — teams are created server-side via service role.

-- TEAM INVITATIONS --------------------------------------------
DROP POLICY IF EXISTS invitations_select ON team_invitations;
CREATE POLICY invitations_select ON team_invitations FOR SELECT TO authenticated
  USING (team_id = public.current_team_id() OR public.is_site_admin());

DROP POLICY IF EXISTS invitations_insert ON team_invitations;
CREATE POLICY invitations_insert ON team_invitations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_site_admin()
    OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.lead_id = auth.uid())
  );

DROP POLICY IF EXISTS invitations_update ON team_invitations;
CREATE POLICY invitations_update ON team_invitations FOR UPDATE TO authenticated
  USING (
    public.is_site_admin()
    OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.lead_id = auth.uid())
  )
  WITH CHECK (
    public.is_site_admin()
    OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.lead_id = auth.uid())
  );

-- PROJECTS -----------------------------------------------------
DROP POLICY IF EXISTS projects_select ON projects;
CREATE POLICY projects_select ON projects FOR SELECT TO authenticated
  USING (team_id = public.current_team_id() OR public.is_site_admin());

DROP POLICY IF EXISTS projects_write ON projects;
CREATE POLICY projects_write ON projects FOR ALL TO authenticated
  USING (
    public.is_site_admin()
    OR (team_id = public.current_team_id() AND public.current_user_role() = 'team_lead')
  )
  WITH CHECK (
    public.is_site_admin()
    OR (team_id = public.current_team_id() AND public.current_user_role() = 'team_lead')
  );

-- Generic project-scoped tables via helper function ------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'milestones','files','comments','doc_pages','goals',
    'announcements','changelog_entries','resources','internal_notes',
    'time_entries','internal_messages'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_all ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_all ON %I FOR ALL TO authenticated
       USING (public.project_in_my_team(project_id))
       WITH CHECK (public.project_in_my_team(project_id))',
      t, t
    );
  END LOOP;
END $$;

-- Milestone assignees ----------------------------------------
DROP POLICY IF EXISTS milestone_assignees_all ON milestone_assignees;
CREATE POLICY milestone_assignees_all ON milestone_assignees FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM milestones m WHERE m.id = milestone_id AND public.project_in_my_team(m.project_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM milestones m WHERE m.id = milestone_id AND public.project_in_my_team(m.project_id))
  );

-- Checklist items -------------------------------------------
DROP POLICY IF EXISTS checklist_items_all ON checklist_items;
CREATE POLICY checklist_items_all ON checklist_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM milestones m WHERE m.id = milestone_id AND public.project_in_my_team(m.project_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM milestones m WHERE m.id = milestone_id AND public.project_in_my_team(m.project_id))
  );

-- Notifications (per-user) ----------------------------------
DROP POLICY IF EXISTS notifications_all ON notifications;
CREATE POLICY notifications_all ON notifications FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_site_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_site_admin());

-- Audit log: team-scoped read only; writes via service role
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT TO authenticated
  USING (team_id = public.current_team_id() OR public.is_site_admin());

-- AI usage: team-scoped read only
DROP POLICY IF EXISTS ai_usage_select ON ai_usage;
CREATE POLICY ai_usage_select ON ai_usage FOR SELECT TO authenticated
  USING (team_id = public.current_team_id() OR public.is_site_admin());

-- Milestone templates
DROP POLICY IF EXISTS milestone_templates_all ON milestone_templates;
CREATE POLICY milestone_templates_all ON milestone_templates FOR ALL TO authenticated
  USING (team_id = public.current_team_id() OR public.is_site_admin())
  WITH CHECK (team_id = public.current_team_id() OR public.is_site_admin());

-- Site settings: readable by all authenticated, writable by site admin
DROP POLICY IF EXISTS site_settings_select ON site_settings;
CREATE POLICY site_settings_select ON site_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS site_settings_update ON site_settings;
CREATE POLICY site_settings_update ON site_settings FOR UPDATE TO authenticated
  USING (public.is_site_admin())
  WITH CHECK (public.is_site_admin());
