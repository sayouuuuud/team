-- ─────────────────────────────────────────────────────────────
-- Phase 1 — Core schema for Team Collaboration Platform
-- Creates all tables from PROJECT_SPEC §15.
-- Existing test_phases / test_sections / test_items tables are left untouched.
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- Enums ---------------------------------------------------------
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('site_admin','team_lead','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE user_language AS ENUM ('ar','en');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE user_theme AS ENUM ('light','dark','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE project_status AS ENUM ('active','paused','completed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE work_mode AS ENUM ('parallel','assigned','mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE milestone_status AS ENUM ('pending','working','review','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE author_kind AS ENUM ('team_member','client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE resource_kind AS ENUM ('brand_asset','guide','credential','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE actor_kind AS ENUM ('user','client','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Teams (lead_id FK added after profiles) ----------------------
CREATE TABLE IF NOT EXISTS teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  lead_id    uuid,
  join_code  text UNIQUE NOT NULL,
  max_files  int  NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles (tied to auth.users) --------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          text,
  role               user_role NOT NULL DEFAULT 'member',
  team_id            uuid REFERENCES teams(id) ON DELETE SET NULL,
  language           user_language NOT NULL DEFAULT 'ar',
  theme              user_theme NOT NULL DEFAULT 'system',
  pending_approval   boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Now add the FK from teams.lead_id -> profiles.id
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_lead_id_fkey;
ALTER TABLE teams
  ADD CONSTRAINT teams_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Team invitations ---------------------------------------------
CREATE TABLE IF NOT EXISTS team_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email       text,
  token       text UNIQUE NOT NULL,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Projects (scaffold — built out in Phase 2) --------------------
CREATE TABLE IF NOT EXISTS projects (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  client_name          text,
  client_email         text,
  description          text,
  status               project_status NOT NULL DEFAULT 'active',
  work_mode            work_mode NOT NULL DEFAULT 'mixed',
  share_token          text UNIQUE,
  share_expires_at     timestamptz,
  share_password_hash  text,
  show_team_to_client  boolean NOT NULL DEFAULT true,
  start_date           date,
  expected_end_date    date,
  created_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Milestones ---------------------------------------------------
CREATE TABLE IF NOT EXISTS milestones (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                   text NOT NULL,
  description             text,
  status                  milestone_status NOT NULL DEFAULT 'pending',
  start_date              date,
  due_date                date,
  progress                int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  order_index             int NOT NULL DEFAULT 0,
  work_mode               work_mode,
  needs_client_approval   boolean NOT NULL DEFAULT false,
  client_approved_at      timestamptz,
  client_rejection_reason text,
  created_by              uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS milestone_assignees (
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, user_id)
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  text         text NOT NULL,
  is_done      boolean NOT NULL DEFAULT false,
  order_index  int NOT NULL DEFAULT 0,
  done_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  done_at      timestamptz
);

-- Files --------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES teams(id)       ON DELETE CASCADE,
  project_id      uuid          REFERENCES projects(id)    ON DELETE CASCADE,
  milestone_id    uuid          REFERENCES milestones(id)  ON DELETE SET NULL,
  filename        text NOT NULL,
  size_bytes      bigint NOT NULL DEFAULT 0,
  blob_url        text NOT NULL,
  uploaded_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  pinned          boolean NOT NULL DEFAULT false,
  is_deleted      boolean NOT NULL DEFAULT false,
  deleted_reason  text,
  deleted_at      timestamptz
);

-- Comments -----------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  author_type  author_kind NOT NULL,
  author_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  author_name  text,
  content      text NOT NULL,
  is_internal  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Internal chat messages ---------------------------------------
CREATE TABLE IF NOT EXISTS internal_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Wiki pages ---------------------------------------------------
CREATE TABLE IF NOT EXISTS doc_pages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id        uuid REFERENCES doc_pages(id) ON DELETE CASCADE,
  title            text NOT NULL,
  content_markdown text,
  last_edited_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Goals --------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  kpi         text,
  progress    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Announcements (internal, per project) ------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title      text NOT NULL,
  content    text,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Changelog (client-visible) -----------------------------------
CREATE TABLE IF NOT EXISTS changelog_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title        text NOT NULL,
  content      text,
  ai_generated boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now()
);

-- Resources (brand / guides / credentials) ---------------------
CREATE TABLE IF NOT EXISTS resources (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type       resource_kind NOT NULL,
  title      text NOT NULL,
  content    text,
  blob_url   text,
  is_public  boolean NOT NULL DEFAULT false,
  encrypted  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Internal notes -----------------------------------------------
CREATE TABLE IF NOT EXISTS internal_notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content_markdown text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Time tracking ------------------------------------------------
CREATE TABLE IF NOT EXISTS time_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id     uuid REFERENCES milestones(id) ON DELETE SET NULL,
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  duration_seconds int,
  description      text
);

-- Notifications ------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit log ----------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  team_id     uuid REFERENCES teams(id) ON DELETE CASCADE,
  actor_type  actor_kind NOT NULL,
  actor_id    uuid,
  actor_name  text,
  event       text NOT NULL,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- AI usage -----------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  feature    text NOT NULL,
  tokens_in  int,
  tokens_out int,
  cost_usd   numeric(10,6),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Milestone templates ------------------------------------------
CREATE TABLE IF NOT EXISTS milestone_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  template_data jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Site settings (single row, id = 1) ---------------------------
CREATE TABLE IF NOT EXISTS site_settings (
  id                      int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_url                text,
  brand_name              text NOT NULL DEFAULT 'Team Collab',
  default_language        user_language NOT NULL DEFAULT 'ar',
  default_theme           user_theme    NOT NULL DEFAULT 'system',
  default_max_files       int  NOT NULL DEFAULT 5,
  max_file_size_mb        int  NOT NULL DEFAULT 500,
  invitation_ttl_days     int  NOT NULL DEFAULT 7,
  ai_enabled              boolean NOT NULL DEFAULT true,
  ai_daily_limit_per_team int NOT NULL DEFAULT 100,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Indexes ------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_team        ON profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_teams_join_code      ON teams(join_code);
CREATE INDEX IF NOT EXISTS idx_invitations_token    ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_team     ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_team        ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project   ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_team           ON audit_log(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_created        ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, read_at);

-- Helper: updated_at auto-bump ---------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_doc_pages_updated ON doc_pages;
CREATE TRIGGER trg_doc_pages_updated BEFORE UPDATE ON doc_pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_internal_notes_updated ON internal_notes;
CREATE TRIGGER trg_internal_notes_updated BEFORE UPDATE ON internal_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_site_settings_updated ON site_settings;
CREATE TRIGGER trg_site_settings_updated BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
