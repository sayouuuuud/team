-- =============================================================================
-- Phase 3 DEEP flow test
-- - Exercises every collab table with the REAL column names used by the UI code
-- - Validates: inserts, updates (touch_updated_at), cascade on project delete,
--   doc_pages hierarchy, threaded comments with parent_id, visibility flags,
--   public resource filtering (is_public + credential exclusion), announcement
--   pinning, changelog published_at, and goals progress clamping.
-- - Every row is removed at the end (manual cleanup, no rollback).
-- =============================================================================

DO $$
DECLARE
  v_team   uuid := gen_random_uuid();
  v_lead   uuid := gen_random_uuid();
  v_proj   uuid := gen_random_uuid();
  v_mile   uuid := gen_random_uuid();
  v_doc_root uuid;
  v_doc_child uuid;
  v_goal  uuid;
  v_ann   uuid;
  v_res_pub uuid;
  v_res_priv uuid;
  v_res_cred uuid;
  v_note  uuid;
  v_msg   uuid;
  v_cmt_root uuid;
  v_cmt_reply uuid;
  v_count int;
  v_updated_before timestamptz;
  v_updated_after  timestamptz;
BEGIN
  -- Need a real auth.users row for profiles FK.
  INSERT INTO auth.users (id, instance_id, email, aud, role)
    VALUES (v_lead, '00000000-0000-0000-0000-000000000000'::uuid,
            'p3-deep-' || v_lead::text || '@test.local',
            'authenticated', 'authenticated');

  INSERT INTO teams (id, name, join_code) VALUES (v_team, 'P3 Deep', 'P3DEEP');
  INSERT INTO profiles (id, full_name, role, team_id)
    VALUES (v_lead, 'P3 Lead', 'team_lead', v_team);
  UPDATE teams SET lead_id = v_lead WHERE id = v_team;

  INSERT INTO projects (id, team_id, name, created_by)
    VALUES (v_proj, v_team, 'P3 Project', v_lead);
  INSERT INTO milestones (id, project_id, title, created_by, order_index)
    VALUES (v_mile, v_proj, 'P3 Milestone', v_lead, 0);

  ---- 1) doc_pages: hierarchy + order_index
  INSERT INTO doc_pages (project_id, title, content_markdown, created_by, order_index)
    VALUES (v_proj, 'Root Page', '# Hello', v_lead, 0)
    RETURNING id INTO v_doc_root;

  INSERT INTO doc_pages (project_id, parent_id, title, content_markdown, created_by, order_index)
    VALUES (v_proj, v_doc_root, 'Child Page', '## Child', v_lead, 0)
    RETURNING id INTO v_doc_child;

  SELECT count(*) INTO v_count FROM doc_pages WHERE project_id = v_proj;
  IF v_count <> 2 THEN RAISE EXCEPTION '[P3-FAIL] doc_pages count=%', v_count; END IF;

  SELECT count(*) INTO v_count FROM doc_pages
    WHERE project_id = v_proj AND parent_id = v_doc_root;
  IF v_count <> 1 THEN RAISE EXCEPTION '[P3-FAIL] doc_pages child lookup=%', v_count; END IF;

  ---- 2) doc_pages touch_updated_at fires (both triggers: trg_doc_pages_updated + trg_touch_updated_at)
  SELECT updated_at INTO v_updated_before FROM doc_pages WHERE id = v_doc_root;
  PERFORM pg_sleep(0.05);
  UPDATE doc_pages SET content_markdown = '# Edited' WHERE id = v_doc_root;
  SELECT updated_at INTO v_updated_after FROM doc_pages WHERE id = v_doc_root;
  IF v_updated_after <= v_updated_before THEN
    RAISE EXCEPTION '[P3-FAIL] doc_pages.updated_at did not move';
  END IF;
  RAISE NOTICE '[P3-OK] doc_pages hierarchy + touch_updated_at';

  ---- 3) goals: progress bounded and clamped
  INSERT INTO goals (project_id, title, description, kpi, progress, created_by)
    VALUES (v_proj, 'Ship MVP', 'Q2 delivery', '100%', 42, v_lead)
    RETURNING id INTO v_goal;
  SELECT progress INTO v_count FROM goals WHERE id = v_goal;
  IF v_count <> 42 THEN RAISE EXCEPTION '[P3-FAIL] goal progress=%', v_count; END IF;

  BEGIN
    UPDATE goals SET progress = 150 WHERE id = v_goal;
    RAISE EXCEPTION '[P3-FAIL] goals.progress > 100 should be blocked';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '[P3-OK] goals.progress CHECK rejects 150';
  END;
  RAISE NOTICE '[P3-OK] goals insert + CHECK enforcement';

  ---- 4) changelog_entries: published_at stored as-is, ai_generated boolean
  INSERT INTO changelog_entries (project_id, title, content, ai_generated, published_at, created_by)
    VALUES (v_proj, 'v0.1 released', 'Initial drop', false, now(), v_lead);
  SELECT count(*) INTO v_count FROM changelog_entries WHERE project_id = v_proj;
  IF v_count <> 1 THEN RAISE EXCEPTION '[P3-FAIL] changelog count=%', v_count; END IF;
  RAISE NOTICE '[P3-OK] changelog_entries insert';

  ---- 5) announcements: pinned flag index works
  INSERT INTO announcements (project_id, title, content, pinned, created_by)
    VALUES (v_proj, 'Pinned notice', 'Read me first', true, v_lead)
    RETURNING id INTO v_ann;
  INSERT INTO announcements (project_id, title, content, pinned, created_by)
    VALUES (v_proj, 'Regular',     'FYI',           false, v_lead);
  SELECT count(*) INTO v_count FROM announcements
    WHERE project_id = v_proj AND pinned = true;
  IF v_count <> 1 THEN RAISE EXCEPTION '[P3-FAIL] pinned count=%', v_count; END IF;
  RAISE NOTICE '[P3-OK] announcements pinned filtering';

  ---- 6) resources: is_public filter + credential exclusion (mirrors /share query)
  INSERT INTO resources (project_id, type, title, content, is_public, created_by)
    VALUES (v_proj, 'brand_asset', 'Logo pack', 'PNG + SVG', true, v_lead)
    RETURNING id INTO v_res_pub;
  INSERT INTO resources (project_id, type, title, content, is_public, created_by)
    VALUES (v_proj, 'guide', 'Internal SOP', 'internal', false, v_lead)
    RETURNING id INTO v_res_priv;
  INSERT INTO resources (project_id, type, title, content, is_public, created_by)
    VALUES (v_proj, 'credential', 'AWS keys', 'secret', true, v_lead)
    RETURNING id INTO v_res_cred;

  -- exactly the query /share/[token] uses
  SELECT count(*) INTO v_count FROM resources
    WHERE project_id = v_proj AND is_public = true AND type <> 'credential';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[P3-FAIL] public non-credential resources=%', v_count;
  END IF;
  RAISE NOTICE '[P3-OK] /share resources filter (public, non-credential) = 1';

  ---- 7) internal_notes + internal_messages (use content_markdown / content)
  INSERT INTO internal_notes (project_id, content_markdown, created_by)
    VALUES (v_proj, 'Call client tomorrow', v_lead)
    RETURNING id INTO v_note;
  INSERT INTO internal_messages (project_id, content, sender_id)
    VALUES (v_proj, 'Hello team', v_lead)
    RETURNING id INTO v_msg;

  SELECT updated_at INTO v_updated_before FROM internal_messages WHERE id = v_msg;
  PERFORM pg_sleep(0.05);
  UPDATE internal_messages SET content = 'Hello team (edited)',
                               edited_at = now()
    WHERE id = v_msg;
  SELECT updated_at INTO v_updated_after FROM internal_messages WHERE id = v_msg;
  IF v_updated_after <= v_updated_before THEN
    RAISE EXCEPTION '[P3-FAIL] internal_messages.updated_at did not move';
  END IF;
  IF (SELECT edited_at FROM internal_messages WHERE id = v_msg) IS NULL THEN
    RAISE EXCEPTION '[P3-FAIL] internal_messages.edited_at not stamped';
  END IF;
  RAISE NOTICE '[P3-OK] internal_messages edit + touch_updated_at';

  ---- 8) comments: author_kind='user', parent_id threading
  INSERT INTO comments (milestone_id, author_type, author_id, content)
    VALUES (v_mile, 'user', v_lead, 'Top-level comment')
    RETURNING id INTO v_cmt_root;
  INSERT INTO comments (milestone_id, parent_id, author_type, author_id, content)
    VALUES (v_mile, v_cmt_root, 'user', v_lead, 'Reply')
    RETURNING id INTO v_cmt_reply;

  SELECT count(*) INTO v_count FROM comments
    WHERE milestone_id = v_mile AND parent_id = v_cmt_root;
  IF v_count <> 1 THEN RAISE EXCEPTION '[P3-FAIL] reply count=%', v_count; END IF;

  -- public/client comment (no author_id) allowed by schema
  INSERT INTO comments (milestone_id, author_type, author_name, content)
    VALUES (v_mile, 'public', 'Ahmed Client', 'Looks good');
  SELECT count(*) INTO v_count FROM comments
    WHERE milestone_id = v_mile AND author_type = 'public';
  IF v_count <> 1 THEN RAISE EXCEPTION '[P3-FAIL] public comment count=%', v_count; END IF;
  RAISE NOTICE '[P3-OK] comments threading + public author';

  ---- 9) Cascade on project delete removes every collab row
  DELETE FROM projects WHERE id = v_proj;

  SELECT
    (SELECT count(*) FROM doc_pages         WHERE project_id = v_proj) +
    (SELECT count(*) FROM goals             WHERE project_id = v_proj) +
    (SELECT count(*) FROM changelog_entries WHERE project_id = v_proj) +
    (SELECT count(*) FROM announcements     WHERE project_id = v_proj) +
    (SELECT count(*) FROM resources         WHERE project_id = v_proj) +
    (SELECT count(*) FROM internal_notes    WHERE project_id = v_proj) +
    (SELECT count(*) FROM internal_messages WHERE project_id = v_proj) +
    (SELECT count(*) FROM comments c        WHERE c.milestone_id = v_mile)
  INTO v_count;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[P3-FAIL] cascade left % orphaned rows', v_count;
  END IF;
  RAISE NOTICE '[P3-OK] cascade cleaned up all collab rows';

  -- Final cleanup (no rollback, no exception).
  DELETE FROM profiles    WHERE id = v_lead;
  DELETE FROM teams       WHERE id = v_team;
  DELETE FROM auth.users  WHERE id = v_lead;

  RAISE NOTICE '[P3-OK] Phase 3 deep flow test PASSED';
END $$;
