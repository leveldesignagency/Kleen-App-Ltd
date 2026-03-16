-- ============================================================================
-- KLEEN — Migration 022: Main admin user info@kleenapp.co.uk
-- Ensures info@kleenapp.co.uk is an admin for the admin dashboard.
-- If the user does not exist, creates them with a one-time password (change on first login).
-- If they already exist (e.g. signed up via Google), sets their profile role to admin.
-- ============================================================================

do $$
declare
  existing_uid uuid;
  new_uid     uuid := gen_random_uuid();
begin
  select id into existing_uid from auth.users where email = 'info@kleenapp.co.uk' limit 1;

  if existing_uid is not null then
    -- User already exists (e.g. signed up); ensure profile exists and set role to admin
    insert into public.profiles (id, email, full_name, role)
    values (
      existing_uid,
      'info@kleenapp.co.uk',
      coalesce((select full_name from public.profiles where id = existing_uid), 'Kleen Admin'),
      'admin'
    )
    on conflict (id) do update set role = 'admin', email = 'info@kleenapp.co.uk';
    raise notice 'info@kleenapp.co.uk set as admin (existing user).';
  else
    -- Create new auth user and profile with role admin
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
      'info@kleenapp.co.uk',
      crypt('KleenAdmin1!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Kleen Admin"}'::jsonb,
      '',
      false
    );

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
      'info@kleenapp.co.uk',
      'email',
      jsonb_build_object('sub', new_uid::text, 'email', 'info@kleenapp.co.uk'),
      now(),
      now(),
      now()
    );

    insert into public.profiles (id, email, full_name, role)
    values (new_uid, 'info@kleenapp.co.uk', 'Kleen Admin', 'admin')
    on conflict (id) do update set role = 'admin', email = 'info@kleenapp.co.uk';

    raise notice 'Admin user created: info@kleenapp.co.uk / KleenAdmin1! — change password on first login.';
  end if;
end $$;
