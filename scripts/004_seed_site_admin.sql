-- Seed the Site Admin user: admin@test.com / 123456
-- Safe to re-run (idempotent): updates password + role if user already exists.

-- Enable pgcrypto for password hashing (crypt / gen_salt)
create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
  v_email   text := 'admin@test.com';
  v_pass    text := '123456';
begin
  -- Check if the auth user already exists
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    -- Create the auth user (email confirmed, bcrypt-hashed password)
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_pass, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', 'Site Admin'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Required identity row (Supabase >= 2024 requires provider_id)
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  else
    -- Reset password + confirm email for existing user
    update auth.users
       set encrypted_password = crypt(v_pass, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_user_id;
  end if;

  -- Upsert profile row with role = site_admin
  insert into public.profiles (id, full_name, role)
  values (v_user_id, 'Site Admin', 'site_admin')
  on conflict (id) do update
    set role      = 'site_admin',
        full_name = coalesce(public.profiles.full_name, 'Site Admin');
end
$$;
