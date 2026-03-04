-- ============================================================================
-- KLEEN — Migration 004: Fix admin user auth
-- Supabase requires an entry in auth.identities for sign-in to work.
-- This deletes and recreates the admin user properly.
-- ============================================================================

-- Clean up the broken user first
delete from auth.users where email = 'ryan@kleen.co.uk';

do $$
declare
  new_uid uuid := gen_random_uuid();
begin
  -- Create auth user with hashed password
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    is_super_admin
  ) values (
    new_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ryan@kleen.co.uk',
    crypt('ryanw1234', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ryan W"}'::jsonb,
    '',
    false
  );

  -- Supabase requires an identity row for email sign-in
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    new_uid,
    new_uid,
    'ryan@kleen.co.uk',
    'email',
    jsonb_build_object('sub', new_uid::text, 'email', 'ryan@kleen.co.uk'),
    now(),
    now(),
    now()
  );

  -- Set profile to admin (handle_new_user trigger creates the row)
  update public.profiles
  set role = 'admin', full_name = 'Ryan W'
  where id = new_uid;

  raise notice 'Admin user created: ryan@kleen.co.uk / ryanw1234';
end $$;
