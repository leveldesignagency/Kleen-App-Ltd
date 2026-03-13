-- ============================================================================
-- KLEEN — Migration 015: Test customer user
-- Adds a dedicated customer test account so the Customers page and customer app
-- can be tested without using the admin account (ryan@kleen.co.uk).
--
-- Test accounts:
--   Admin:   ryan@kleen.co.uk / ryanw1234   (from 003/004)
--   Customer: customer@kleen.co.uk / customer123
-- ============================================================================

do $$
declare
  new_uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'customer@kleen.co.uk') then
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
      'customer@kleen.co.uk',
      crypt('customer123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test Customer"}'::jsonb,
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
      'customer@kleen.co.uk',
      'email',
      jsonb_build_object('sub', new_uid::text, 'email', 'customer@kleen.co.uk'),
      now(),
      now(),
      now()
    );

    -- handle_new_user trigger creates profile with role 'customer' by default
    update public.profiles
    set full_name = 'Test Customer'
    where id = new_uid;

    raise notice 'Customer test user created: customer@kleen.co.uk / customer123';
  else
    raise notice 'Customer test user already exists: customer@kleen.co.uk';
  end if;
end $$;
