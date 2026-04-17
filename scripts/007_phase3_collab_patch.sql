-- ─────────────────────────────────────────────────────────────
-- Phase 3 — Collaboration DB patch
-- Adds the columns + indexes needed for:
--   • Wiki (doc_pages) hierarchical ordering
--   • Threaded comments (optional parent reference)
--   • Internal chat edit tracking + fast project listing
--   • Notifications indexing (unread queue)
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- Wiki pages: preserve order inside a parent
ALTER TABLE doc_pages
  ADD COLUMN IF NOT EXISTS order_index int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_doc_pages_parent_order
  ON doc_pages(project_id, parent_id, order_index);

-- Comments: allow threaded replies (Phase 3 "ردود")
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_milestone_created
  ON comments(milestone_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON comments(parent_id) WHERE parent_id IS NOT NULL;

-- Internal chat: edit tracking + fast project-scoped reads
ALTER TABLE internal_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_internal_messages_project_created
  ON internal_messages(project_id, created_at);

-- Resources: fast listing per project + public filter
CREATE INDEX IF NOT EXISTS idx_resources_project
  ON resources(project_id);

CREATE INDEX IF NOT EXISTS idx_resources_public
  ON resources(project_id) WHERE is_public = true;

-- Changelog: public share page reads the most recent first
CREATE INDEX IF NOT EXISTS idx_changelog_project_date
  ON changelog_entries(project_id, published_at DESC);

-- Announcements: pinned first, then newest
CREATE INDEX IF NOT EXISTS idx_announcements_project_pinned
  ON announcements(project_id, pinned DESC, created_at DESC);

-- Goals: one line per project ordered
CREATE INDEX IF NOT EXISTS idx_goals_project
  ON goals(project_id, created_at);

-- Internal notes: per-project access
CREATE INDEX IF NOT EXISTS idx_internal_notes_project
  ON internal_notes(project_id, created_at DESC);

-- Notifications: unread list is the hot path
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
