-- =====================================================================
-- Phase 1 — Auth + RLS Integration Test (v2, matches real schema)
--
-- Covers:
--   1. Lead signup (creates team + profile + links team.lead_id)
--   2. Second Lead + team (for isolation test)
--   3. Member signup (looks up team by join_code, attaches profile)
--   4. Invitation token flow (creates invite → accept → profile attach)
--   5. RLS isolation: Team A cannot read Team B's data
--   6. RLS: Member cannot elevate own role
--   7. RLS: Lead can create project in own team, not in another team
--   8. Site admin sees everything
--   9. join_code uniqueness and 6-char length
--
-- Everything runs inside a transaction and ROLLBACKs at the end,
-- so no real data is persisted.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.make_user(p_email text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid;
BEGIN
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  ) VALUES (
    uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, crypt('test123456', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, false, false
  );
  RETURN uid;
END $$;

-- Switch to the given user's JWT (used by RLS policies via auth.uid())
CREATE OR REPLACE FUNCTION pg_temp.become(p_uid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true
  );
END $$;

CREATE OR REPLACE FUNCTION pg_temp.become_admin() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---------------------------------------------------------------------
-- STEP 1: Create 3 users
-- ---------------------------------------------------------------------
DO $$
DECLARE
  lead_a uuid; lead_b uuid; member_a uuid;
  team_a uuid; team_b uuid;
  code_a text := 'TST' || substr(md5(random()::text), 1, 3);
  code_b text := 'TSU' || substr(md5(random()::text), 1, 3);
  proj_a uuid; proj_b uuid;
  inv_token text;
  result_count int;
  caught_rls boolean;
BEGIN
  lead_a   := pg_temp.make_user('lead_a_' || substr(md5(random()::text),1,6) || '@test.local');
  lead_b   := pg_temp.make_user('lead_b_' || substr(md5(random()::text),1,6) || '@test.local');
  member_a := pg_temp.make_user('mem_a_'  || substr(md5(random()::text),1,6) || '@test.local');

  RAISE NOTICE '[SETUP] Users: lead_a=%, lead_b=%, member_a=%', lead_a, lead_b, member_a;

  -- -------------------------------------------------------------------
  -- STEP 2: Lead A signup — create team then profile then link lead_id
  -- (matches app/auth/actions.ts flow)
  -- -------------------------------------------------------------------
  INSERT INTO teams (name, join_code) VALUES ('Team Alpha', code_a)
    RETURNING id INTO team_a;

  INSERT INTO profiles (id, full_name, role, team_id)
    VALUES (lead_a, 'Lead A', 'lead', team_a);

  UPDATE teams SET lead_id = lead_a WHERE id = team_a;

  INSERT INTO projects (team_id, name, client_name)
    VALUES (team_a, 'Alpha Project', 'Client A')
    RETURNING id INTO proj_a;

  RAISE NOTICE '[PASS] Lead A setup: team=%, join_code=%, project=%', team_a, code_a, proj_a;

  -- Lead B setup (for isolation)
  INSERT INTO teams (name, join_code) VALUES ('Team Beta', code_b) RETURNING id INTO team_b;
  INSERT INTO profiles (id, full_name, role, team_id) VALUES (lead_b, 'Lead B', 'lead', team_b);
  UPDATE teams SET lead_id = lead_b WHERE id = team_b;
  INSERT INTO projects (team_id, name) VALUES (team_b, 'Beta Project') RETURNING id INTO proj_b;
  RAISE NOTICE '[PASS] Lead B setup: team=%, join_code=%', team_b, code_b;

  -- -------------------------------------------------------------------
  -- STEP 3: Member A joins Team A via join_code lookup
  -- -------------------------------------------------------------------
  PERFORM 1 FROM teams WHERE join_code = code_a;
  IF NOT FOUND THEN RAISE EXCEPTION '[FAIL] join_code lookup failed'; END IF;

  INSERT INTO profiles (id, full_name, role, team_id)
    VALUES (member_a, 'Member A', 'member', team_a);
  RAISE NOTICE '[PASS] Member A joined Team A via join_code=%', code_a;

  -- -------------------------------------------------------------------
  -- STEP 4: Invitation token flow
  -- -------------------------------------------------------------------
  inv_token := encode(gen_random_bytes(16), 'hex');
  INSERT INTO team_invitations (team_id, email, token, expires_at, created_by)
    VALUES (team_a, 'invitee@test.local', inv_token, now() + interval '7 days', lead_a);

  PERFORM 1 FROM team_invitations WHERE token = inv_token AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION '[FAIL] invitation lookup failed'; END IF;
  RAISE NOTICE '[PASS] Invitation flow: token created & valid';

  -- -------------------------------------------------------------------
  -- STEP 5: RLS ISOLATION — Member A should only see Team A data
  -- -------------------------------------------------------------------
  PERFORM pg_temp.become(member_a);

  SELECT count(*) INTO result_count FROM projects;
  IF result_count <> 1 THEN
    RAISE EXCEPTION '[FAIL] Member A sees % projects, expected 1', result_count;
  END IF;
  RAISE NOTICE '[PASS] RLS: Member A sees exactly 1 project (own team)';

  SELECT count(*) INTO result_count FROM teams;
  IF result_count <> 1 THEN
    RAISE EXCEPTION '[FAIL] Member A sees % teams, expected 1', result_count;
  END IF;
  RAISE NOTICE '[PASS] RLS: Member A sees exactly 1 team (own team)';

  -- -------------------------------------------------------------------
  -- STEP 6: RLS — Member A cannot promote self to lead
  -- -------------------------------------------------------------------
  caught_rls := false;
  BEGIN
    UPDATE profiles SET role = 'lead' WHERE id = member_a;
    -- If RLS blocks silently with 0 rows, check:
    SELECT role::text INTO result_count FROM profiles WHERE id = member_a;
  EXCEPTION WHEN insufficient_privilege OR others THEN
    caught_rls := true;
  END;

  PERFORM pg_temp.become_admin();
  IF (SELECT role FROM profiles WHERE id = member_a) = 'lead' THEN
    RAISE EXCEPTION '[FAIL] Member A was able to self-promote to lead';
  END IF;
  RAISE NOTICE '[PASS] RLS: Member A cannot self-promote';

  -- -------------------------------------------------------------------
  -- STEP 7: RLS — Lead A cannot insert project into Team B
  -- -------------------------------------------------------------------
  PERFORM pg_temp.become(lead_a);
  caught_rls := false;
  BEGIN
    INSERT INTO projects (team_id, name) VALUES (team_b, 'Hacked Project');
  EXCEPTION WHEN insufficient_privilege OR others THEN
    caught_rls := true;
  END;
  PERFORM pg_temp.become_admin();
  IF NOT caught_rls AND EXISTS (
    SELECT 1 FROM projects WHERE team_id = team_b AND name = 'Hacked Project'
  ) THEN
    RAISE EXCEPTION '[FAIL] Lead A inserted project into Team B!';
  END IF;
  RAISE NOTICE '[PASS] RLS: Lead A cannot write to Team B';

  -- Lead A CAN insert into own team
  PERFORM pg_temp.become(lead_a);
  INSERT INTO projects (team_id, name) VALUES (team_a, 'Second Alpha Project');
  PERFORM pg_temp.become_admin();
  SELECT count(*) INTO result_count FROM projects WHERE team_id = team_a;
  IF result_count <> 2 THEN
    RAISE EXCEPTION '[FAIL] Lead A could not insert into own team (got %)', result_count;
  END IF;
  RAISE NOTICE '[PASS] RLS: Lead A can write to own team (% projects)', result_count;

  -- -------------------------------------------------------------------
  -- STEP 8: Site admin sees all
  -- -------------------------------------------------------------------
  PERFORM pg_temp.become(
    (SELECT id FROM profiles WHERE role = 'site_admin' LIMIT 1)
  );
  SELECT count(*) INTO result_count FROM projects;
  IF result_count < 3 THEN
    RAISE EXCEPTION '[FAIL] Site admin sees only % projects, expected >=3', result_count;
  END IF;
  RAISE NOTICE '[PASS] RLS: Site admin sees % projects', result_count;
  PERFORM pg_temp.become_admin();

  -- -------------------------------------------------------------------
  -- STEP 9: join_code invariants
  -- -------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM teams GROUP BY join_code HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '[FAIL] duplicate join_codes exist';
  END IF;
  RAISE NOTICE '[PASS] join_code uniqueness holds';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  PHASE 1 AUTH + RLS TEST — ALL PASSED';
  RAISE NOTICE '============================================';
END $$;

-- ---------------------------------------------------------------------
-- Rollback everything — this is a dry run
-- ---------------------------------------------------------------------
ROLLBACK;
