-- ─────────────────────────────────────────────────────────────
-- Phase 2 — Files patch: UploadThing storage_key + mime_type
-- Idempotent.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_key text;
ALTER TABLE files ADD COLUMN IF NOT EXISTS mime_type  text;

CREATE INDEX IF NOT EXISTS idx_files_project   ON files(project_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_files_milestone ON files(milestone_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_files_team      ON files(team_id)    WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_milestones_order ON milestones(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_checklist_order  ON checklist_items(milestone_id, order_index);
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token) WHERE share_token IS NOT NULL;
