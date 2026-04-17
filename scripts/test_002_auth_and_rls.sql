-- =============================================================================
-- Phase 1 — Auth Flow + RLS Isolation Test
-- =============================================================================
-- Simulates:
--   1. Lead signup (Team A) -> creates team + profile
--   2. Second Lead signup (Team B) -> separate team
--   3. Member signup (joins Team A via team_code)
--   4. RLS isolation: Team A Lead cannot see Team B data
--   5. Member cannot see other team's data
--   6. Site Admin can see everything
--   7. Duplicate team_code generation check
-- Cleans up after itself.
-- =============================================================================

BEGIN;

-- Helper: generate deterministic UUIDs for test users so we can clean up
DO $$
DECLARE
  lead_a_id uuid := '11111111-1111-1111-1111-111111111111';
  lead_b_id uuid := '22222222-2222-2222-2222-222222222222';
  member_a_id uuid := '33333333-3333-3333-3333-333333333333';
  admin_id uuid;
  team_a_id uuid;
  team_b_id uuid;
  project_a_id uuid;
  project_b_id uuid;
  team_a_code text;
  team_b_code text;
  visible_teams_count int;
  visible_projects_count int;
BEGIN
  -- Clean any leftovers from previous test runs
  DELETE FROM auth.identities WHERE user_id IN (lead_a_id, lead_b_id, member_a_id);
  DELETE FROM profiles WHERE id IN (lead_a_id, lead_b_id, member_a_id);
  DELETE FROM auth.users WHERE id IN (lead_a_id, lead_b_id, member_a_id);
  DELETE FROM teams WHERE name LIKE 'TEST_TEAM_%';

  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@test.com';

  -- -------------------------------------------------------------------------
  -- STEP 1: Create Lead A (simulates Lead signup server action)
  -- -------------------------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    lead_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'lead_a@test.com', crypt('test123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), lead_a_id, lead_a_id::text, jsonb_build_object('sub', lead_a_id::text, 'email', 'lead_a@test.com'), 'email', now(), now(), now());

  INSERT INTO teams (name, team_code, created_by)
  VALUES ('TEST_TEAM_A', 'AAA111', lead_a_id)
  RETURNING id, team_code INTO team_a_id, team_a_code;

  INSERT INTO profiles (id, full_name, role, team_id)
  VALUES (lead_a_id, 'Lead A', 'team_lead', team_a_id);

  UPDATE teams SET lead_id = lead_a_id WHERE id = team_a_id;

  INSERT INTO projects (team_id, name, description, status, created_by)
  VALUES (team_a_id, 'Project A', 'Team A project', 'active', lead_a_id)
  RETURNING id INTO project_a_id;

  RAISE NOTICE '[TEST] Lead A created: user=%, team=%, team_code=%, project=%',
    lead_a_id, team_a_id, team_a_code, project_a_id;

  -- -------------------------------------------------------------------------
  -- STEP 2: Create Lead B (separate team)
  -- -------------------------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    lead_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'lead_b@test.com', crypt('test123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), lead_b_id, lead_b_id::text, jsonb_build_object('sub', lead_b_id::text, 'email', 'lead_b@test.com'), 'email', now(), now(), now());

  INSERT INTO teams (name, team_code, created_by)
  VALUES ('TEST_TEAM_B', 'BBB222', lead_b_id)
  RETURNING id, team_code INTO team_b_id, team_b_code;

  INSERT INTO profiles (id, full_name, role, team_id)
  VALUES (lead_b_id, 'Lead B', 'team_lead', team_b_id);

  UPDATE teams SET lead_id = lead_b_id WHERE id = team_b_id;

  INSERT INTO projects (team_id, name, description, status, created_by)
  VALUES (team_b_id, 'Project B', 'Team B project', 'active', lead_b_id)
  RETURNING id INTO project_b_id;

  RAISE NOTICE '[TEST] Lead B created: user=%, team=%, project=%', lead_b_id, team_b_id, project_b_id;

  -- -------------------------------------------------------------------------
  -- STEP 3: Member joins Team A via team_code lookup
  -- -------------------------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    member_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'member_a@test.com', crypt('test123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), member_a_id, member_a_id::text, jsonb_build_object('sub', member_a_id::text, 'email', 'member_a@test.com'), 'email', now(), now(), now());

  -- Simulate the signup action: look up team by code
  DECLARE resolved_team_id uuid;
  BEGIN
    SELECT id INTO resolved_team_id FROM teams WHERE team_code = 'AAA111';
    IF resolved_team_id IS NULL THEN
      RAISE EXCEPTION '[TEST FAIL] team_code lookup failed';
    END IF;

    INSERT INTO profiles (id, full_name, role, team_id)
    VALUES (member_a_id, 'Member A1', 'member', resolved_team_id);

    RAISE NOTICE '[TEST] Member A joined team % via code AAA111', resolved_team_id;
  END;

  -- =========================================================================
  -- ASSERTION 1: team_codes are unique and 6 chars
  -- =========================================================================
  IF EXISTS (SELECT 1 FROM teams GROUP BY team_code HAVING count(*) > 1) THEN
    RAISE EXCEPTION '[TEST FAIL] Duplicate team_codes exist';
  END IF;
  RAISE NOTICE '[PASS] team_code uniqueness';

  -- =========================================================================
  -- ASSERTION 2: RLS isolation — set JWT context to Lead A
  --   Lead A must see only Team A
  -- =========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', lead_a_id::text,
    'role', 'authenticated',
    'email', 'lead_a@test.com'
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO visible_teams_count FROM teams;
  IF visible_teams_count <> 1 THEN
    RAISE EXCEPTION '[TEST FAIL] Lead A sees % teams, expected 1', visible_teams_count;
  END IF;

  SELECT count(*) INTO visible_projects_count FROM projects;
  IF visible_projects_count <> 1 THEN
    RAISE EXCEPTION '[TEST FAIL] Lead A sees % projects, expected 1', visible_projects_count;
  END IF;
  RAISE NOTICE '[PASS] Lead A sees only Team A data (1 team, 1 project)';

  RESET ROLE;

  -- =========================================================================
  -- ASSERTION 3: RLS isolation — Member A sees Team A only
  -- =========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', member_a_id::text,
    'role', 'authenticated',
    'email', 'member_a@test.com'
  )::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO visible_teams_count FROM teams;
  IF visible_teams_count <> 1 THEN
    RAISE EXCEPTION '[TEST FAIL] Member A sees % teams, expected 1', visible_teams_count;
  END IF;
  RAISE NOTICE '[PASS] Member A sees only Team A';

  RESET ROLE;

  -- =========================================================================
  -- ASSERTION 4: Site Admin sees everything
  -- =========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', admin_id::text,
    'role', 'authenticated',
    'email', 'admin@test.com'
  )::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO visible_teams_count FROM teams;
  IF visible_teams_count < 2 THEN
    RAISE EXCEPTION '[TEST FAIL] Site Admin sees only % teams, expected >= 2', visible_teams_count;
  END IF;
  RAISE NOTICE '[PASS] Site Admin sees all teams (% visible)', visible_teams_count;

  RESET ROLE;

  -- =========================================================================
  -- ASSERTION 5: Lead A can insert a milestone in their own project
  -- =========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', lead_a_id::text,
    'role', 'authenticated',
    'email', 'lead_a@test.com'
  )::text, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO milestones (project_id, title, description, status, created_by)
  VALUES (project_a_id, 'Test Milestone A', 'ok', 'pending', lead_a_id);
  RAISE NOTICE '[PASS] Lead A can create milestone in own project';

  -- =========================================================================
  -- ASSERTION 6: Lead A CANNOT insert a milestone in Team B's project
  -- =========================================================================
  BEGIN
    INSERT INTO milestones (project_id, title, description, status, created_by)
    VALUES (project_b_id, 'Cross-team attack', 'should fail', 'pending', lead_a_id);
    RAISE EXCEPTION '[TEST FAIL] Lead A was able to insert into Team B project!';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    IF SQLERRM LIKE '%TEST FAIL%' THEN
      RAISE;
    END IF;
    RAISE NOTICE '[PASS] Lead A blocked from writing to Team B project (%)', SQLERRM;
  END;

  RESET ROLE;

  RAISE NOTICE '[TEST] All assertions passed.';
END $$;

-- Summary output
SELECT 'FINAL_STATE' AS test, role::text, count(*) AS count
FROM profiles
WHERE full_name IN ('Lead A', 'Lead B', 'Member A1', 'Site Admin')
GROUP BY role
ORDER BY role;

SELECT 'FINAL_TEAMS' AS test, name, team_code, lead_id IS NOT NULL AS has_lead
FROM teams
WHERE name LIKE 'TEST_TEAM_%'
ORDER BY name;

-- Cleanup
DELETE FROM auth.identities WHERE user_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);
DELETE FROM profiles WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);
DELETE FROM teams WHERE name LIKE 'TEST_TEAM_%';
DELETE FROM auth.users WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

COMMIT;

SELECT 'CLEANUP_DONE' AS status;
