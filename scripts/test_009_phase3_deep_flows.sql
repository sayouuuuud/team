-- =============================================================================
-- Phase 3 DEEP flow test (rewrite)
-- ----------------------------------------------------------------------------
-- Uses the REAL column names from scripts 001 / 007 / 013 / 014 / 015:
--   doc_pages        : last_edited_by (not created_by), order_index
--   goals            : kpi, progress (0..100 CHECK from 015), no created_by
--   announcements    : author_id, pinned, content
--   changelog_entries: author_id, content, ai_generated, published_at
--   resources        : type (enum), is_public, content, blob_url, no author
--   internal_notes   : author_id, content_markdown
--   internal_messages: author_id (NOT sender_id), content, edited_at (007)
--   comments         : milestone_id (no project_id), author_type
--                      ('team_member' | 'client'), parent_id (007), updated_at
--
-- Creates a real auth.users row, performs asserts, cleans up. Nothing persists.
-- =============================================================================

DO $$
DECLARE
  v_user        uuid := gen_random_uuid();
  v_team        uuid := gen_random_uuid();
  v_proj        uuid := gen_random_uuid();
  v_mile        uuid := gen_random_uuid();
  v_doc_root    uuid;
  v_doc_child   uuid;
  v_goal        uuid;
  v_ann         uuid;
  v_res_public  uuid;
  v_res_priv    uuid;
  v_res_cred    uuid;
  v_note        uuid;
  v_msg         uuid;
  v_cmt_root    uuid;
  v_cmt_reply   uuid;
  v_count       int;
  v_updated_before timestamptz;
  v_updated_after  timestamptz;
BEGIN
  -- ---- Setup (auth user, team, project, milestone) -------------------------
  INSERT INTO auth.users (id, instance_id, email, aud, role)
    VALUES (v_user, '00000000-0000-0000-0000-000000000000'::uuid,
            'p3-deep-' || v_user::text || '@test.local',
            'authenticated', 'authenticated');

  INSERT INTO teams (id, name, join_code) VALUES (v_team, 'P3 Deep', 'P3DEEP');
  INSERT INTO profiles (id, full_name, role, team_id)
    VALUES (v_user, 'P3 Lead', 'team_lead', v_team);
  UPDATE teams SET lead_id = v_user WHERE id = v_team;

  INSERT INTO projects (id, team_id, name, created_by)
    VALUES (v_proj, v_team, 'P3 Project', v_user);
  INSERT INTO milestones (id, project_id, title, created_by, order_index)
    VALUES (v_mile, v_proj, 'P3 Milestone', v_user, 0);

  -- ---- 1) doc_pages : hierarchy + cascade + touch_updated_at --------------
  INSERT INTO doc_pages (project_id, title, content_markdown, last_edited_by, order_index)
    VALUES (v_proj, 'Root Page', '# Hello', v_user, 0)
    RETURNING id INTO v_doc_root;

  INSERT INTO doc_pages (project_id, parent_id, title, content_markdown, last_edited_by, order_index)
    VALUES (v_proj, v_doc_root, 'Child Page', '## Details', v_user, 0)
    RETURNING id INTO v_doc_child;

  SELECT count(*) INTO v_count FROM doc_pages
    WHERE project_id = v_proj AND parent_id = v_doc_root;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[P3-FAIL] doc_pages child lookup=%', v_count;
  END IF;

  SELECT updated_at INTO v_updated_before FROM doc_pages WHERE id = v_doc_root;
  PERFORM pg_sleep(0.05);
  UPDATE doc_pages SET content_markdown = '# Edited' WHERE id = v_doc_root;
  SELECT updated_at INTO v_updated_after FROM doc_pages WHERE id = v_doc_root;
  IF v_updated_after <= v_updated_before THEN
    RAISE EXCEPTION '[P3-FAIL] doc_pages.updated_at did not move';
  END IF;

  DELETE FROM doc_pages WHERE id = v_doc_root;
  SELECT count(*) INTO v_count FROM doc_pages WHERE id = v_doc_child;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[P3-FAIL] doc_pages child not cascade-deleted';
  END IF;
  RAISE NOTICE '[P3-OK] doc_pages hierarchy + cascade + touch_updated_at';

  -- ---- 2) goals : insert + progress CHECK (added by 015) ------------------
  INSERT INTO goals (project_id, title, description, kpi, progress)
    VALUES (v_proj, 'Ship MVP', 'Q2 delivery', '100%', 42)
    RETURNING id INTO v_goal;

  BEGIN
    UPDATE goals SET progress = 150 WHERE id = v_goal;
    RAISE EXCEPTION '[P3-FAIL] goals.progress allowed 150';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE goals SET progress = -5 WHERE id = v_goal;
    RAISE EXCEPTION '[P3-FAIL] goals.progress allowed -5';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE goals SET progress = 100 WHERE id = v_goal;
  RAISE NOTICE '[P3-OK] goals.progress CHECK enforced';

  -- ---- 3) announcements : pinning ----------------------------------------
  INSERT INTO announcements (project_id, author_id, title, content, pinned)
    VALUES (v_proj, v_user, 'Pinned notice', 'Read me first', true)
    RETURNING id INTO v_ann;
  INSERT INTO announcements (project_id, author_id, title, content, pinned)
    VALUES (v_proj, v_user, 'Regular', 'FYI', false);

  SELECT count(*) INTO v_count FROM announcements
    WHERE project_id = v_proj AND pinned = true;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[P3-FAIL] pinned count=%', v_count;
  END IF;
  RAISE NOTICE '[P3-OK] announcements pinning';

  -- ---- 4) changelog_entries ----------------------------------------------
  INSERT INTO changelog_entries (project_id, author_id, title, content, ai_generated, published_at)
    VALUES (v_proj, v_user, 'v0.1', 'first release', false, now());
  SELECT count(*) INTO v_count FROM changelog_entries WHERE project_id = v_proj;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[P3-FAIL] changelog count=%', v_count;
  END IF;
  RAISE NOTICE '[P3-OK] changelog_entries insert';

  -- ---- 5) resources : /share filter (public + non-credential) ------------
  INSERT INTO resources (project_id, type, title, content, is_public)
    VALUES (v_proj, 'brand_asset', 'Logo pack', 'PNG + SVG', true)
    RETURNING id INTO v_res_public;
  INSERT INTO resources (project_id, type, title, content, is_public)
    VALUES (v_proj, 'guide', 'Internal SOP', 'internal', false)
    RETURNING id INTO v_res_priv;
  INSERT INTO resources (project_id, type, title, content, is_public, encrypted)
    VALUES (v_proj, 'credential', 'AWS keys', 'secret', true, true)
    RETURNING id INTO v_res_cred;

  -- Mirror the exact filter used by /share/[token]/page.tsx:
  --     is_public = true  AND  type <> 'credential'
  SELECT count(*) INTO v_count FROM resources
    WHERE project_id = v_proj
      AND is_public = true
      AND type <> 'credential';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[P3-FAIL] /share resource filter expected 1, got %', v_count;
  END IF;
  RAISE NOTICE '[P3-OK] resources /share filter (public + non-credential) = 1';

  -- ---- 6) internal_notes : touch_updated_at ------------------------------
  INSERT INTO internal_notes (project_id, author_id, content_markdown)
    VALUES (v_proj, v_user, 'internal only')
    RETURNING id INTO v_note;

  SELECT updated_at INTO v_updated_before FROM internal_notes WHERE id = v_note;
  PERFORM pg_sleep(0.05);
  UPDATE internal_notes SET content_markdown = 'edited' WHERE id = v_note;
  SELECT updated_at INTO v_updated_after FROM internal_notes WHERE id = v_note;
  IF v_updated_after <= v_updated_before THEN
    RAISE EXCEPTION '[P3-FAIL] internal_notes.updated_at did not advance';
  END IF;
  RAISE NOTICE '[P3-OK] internal_notes touch_updated_at';

  -- ---- 7) internal_messages : edit + edited_at ---------------------------
  INSERT INTO internal_messages (project_id, author_id, content)
    VALUES (v_proj, v_user, 'hello team')
    RETURNING id INTO v_msg;

  IF (SELECT edited_at FROM internal_messages WHERE id = v_msg) IS NOT NULL THEN
    RAISE EXCEPTION '[P3-FAIL] internal_messages.edited_at should start NULL';
  END IF;

  PERFORM pg_sleep(0.05);
  UPDATE internal_messages
    SET content = 'hello team (edited)',
        edited_at = now()
    WHERE id = v_msg;

  IF (SELECT edited_at FROM internal_messages WHERE id = v_msg) IS NULL THEN
    RAISE EXCEPTION '[P3-FAIL] internal_messages.edited_at did not persist';
  END IF;
  RAISE NOTICE '[P3-OK] internal_messages edit + edited_at';

  -- ---- 8) comments : threading + 'team_member'/'client' author types ----
  INSERT INTO comments (milestone_id, author_type, author_id, author_name,
                        content, is_internal, parent_id)
    VALUES (v_mile, 'team_member', v_user, 'P3 Lead',
            'Top-level', false, NULL)
    RETURNING id INTO v_cmt_root;

  INSERT INTO comments (milestone_id, author_type, author_id, author_name,
                        content, is_internal, parent_id)
    VALUES (v_mile, 'team_member', v_user, 'P3 Lead',
            'Reply', false, v_cmt_root)
    RETURNING id INTO v_cmt_reply;

  -- Client comment (no author_id) must work via 'client' enum value.
  INSERT INTO comments (milestone_id, author_type, author_id, author_name,
                        content, is_internal, parent_id)
    VALUES (v_mile, 'client', NULL, 'Ahmed Client',
            'Question?', false, v_cmt_root);

  SELECT count(*) INTO v_count FROM comments
    WHERE milestone_id = v_mile AND parent_id = v_cmt_root;
  IF v_count <> 2 THEN
    RAISE EXCEPTION '[P3-FAIL] threaded replies=% (expected 2)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM comments
    WHERE milestone_id = v_mile AND author_type = 'client';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[P3-FAIL] client comment count=%', v_count;
  END IF;

  -- updated_at trigger on comments
  SELECT updated_at INTO v_updated_before FROM comments WHERE id = v_cmt_root;
  PERFORM pg_sleep(0.05);
  UPDATE comments SET content = 'Top-level (edited)' WHERE id = v_cmt_root;
  SELECT updated_at INTO v_updated_after FROM comments WHERE id = v_cmt_root;
  IF v_updated_after <= v_updated_before THEN
    RAISE EXCEPTION '[P3-FAIL] comments.updated_at did not advance';
  END IF;
  RAISE NOTICE '[P3-OK] comments threading + client author + touch_updated_at';

  -- ---- 9) Cascade on project delete --------------------------------------
  DELETE FROM projects WHERE id = v_proj;

  SELECT
    (SELECT count(*) FROM doc_pages         WHERE project_id = v_proj) +
    (SELECT count(*) FROM goals             WHERE project_id = v_proj) +
    (SELECT count(*) FROM announcements     WHERE project_id = v_proj) +
    (SELECT count(*) FROM changelog_entries WHERE project_id = v_proj) +
    (SELECT count(*) FROM resources         WHERE project_id = v_proj) +
    (SELECT count(*) FROM internal_notes    WHERE project_id = v_proj) +
    (SELECT count(*) FROM internal_messages WHERE project_id = v_proj) +
    (SELECT count(*) FROM milestones        WHERE project_id = v_proj) +
    (SELECT count(*) FROM comments          WHERE milestone_id = v_mile)
  INTO v_count;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[P3-FAIL] project cascade left % orphaned rows', v_count;
  END IF;
  RAISE NOTICE '[P3-OK] project cascade wiped all collab rows';

  -- ---- Cleanup (no rollback, manual DELETEs) -----------------------------
  DELETE FROM profiles    WHERE id = v_user;
  DELETE FROM teams       WHERE id = v_team;
  DELETE FROM auth.users  WHERE id = v_user;

  RAISE NOTICE '[P3-DONE] Phase 3 deep flow test PASSED';
END $$;
