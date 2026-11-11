-- =============================================================================
-- Reset / create admin: info@kleenapp.co.uk
-- Run in Supabase Dashboard → SQL Editor → Run
--
-- SECURITY: Do NOT commit real passwords. Set admin_password below only in the
-- SQL Editor session, then change it again in Authentication → Users after login.
-- Prefer: Auth → Users → Add user / Reset password (no SQL password at all).
-- =============================================================================

-- Fix NULL tokens (prevents "Database error querying schema" on sign-in)
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token     = COALESCE(recovery_token, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL;

DO $$
DECLARE
  admin_email text := 'info@kleenapp.co.uk';
  -- Paste a strong one-time password here in the SQL Editor only (never commit it):
  admin_password text := NULL; -- e.g. 'replace-me-then-rotate'
  uid uuid;
BEGIN
  IF admin_password IS NULL OR length(trim(admin_password)) < 12 THEN
    RAISE EXCEPTION
      'Set admin_password in this script (12+ chars) before running, or create/reset the user in Auth → Users instead.';
  END IF;

  SELECT id INTO uid FROM auth.users WHERE email = admin_email LIMIT 1;

  IF uid IS NULL THEN
    uid := gen_random_uuid();

    INSERT INTO auth.users (
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
      recovery_token,
      is_super_admin
    ) VALUES (
      uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Kleen Admin"}'::jsonb,
      '',
      '',
      false
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      uid,
      uid,
      admin_email,
      'email',
      jsonb_build_object('sub', uid::text, 'email', admin_email),
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Created admin user %. Change password immediately after first login.', admin_email;
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = crypt(admin_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token     = COALESCE(recovery_token, ''),
      updated_at = now()
    WHERE id = uid;

    IF NOT EXISTS (
      SELECT 1 FROM auth.identities
      WHERE user_id = uid AND provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        uid, uid, admin_email, 'email',
        jsonb_build_object('sub', uid::text, 'email', admin_email),
        now(), now(), now()
      );
    END IF;

    RAISE NOTICE 'Reset password for %. Change it again after login.', admin_email;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (uid, admin_email, 'Kleen Admin', 'admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin', email = admin_email, full_name = COALESCE(public.profiles.full_name, 'Kleen Admin');
END $$;
