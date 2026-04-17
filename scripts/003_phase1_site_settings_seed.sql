-- ─────────────────────────────────────────────────────────────
-- Phase 1 — Seed: site_settings singleton row
-- The Site Admin (Owner) auth user is seeded separately via
-- scripts/004_seed_site_admin.mjs (needs Supabase admin API).
-- ─────────────────────────────────────────────────────────────

INSERT INTO site_settings (id, brand_name, default_language, default_theme)
VALUES (1, 'Team Collab', 'ar', 'system')
ON CONFLICT (id) DO NOTHING;
