-- =============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR TO FIX ADMIN LOGIN (500 / "Database error
-- querying schema") at https://admin.kleenapp.co.uk/login
-- =============================================================================
-- Copy the whole script below into: Supabase Dashboard → SQL Editor → New query
-- Then click Run. Then try logging in again as info@kleenapp.co.uk
-- =============================================================================

-- Fix 1: Set token columns to empty string (NULL causes 500 on sign-in)
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token     = COALESCE(recovery_token, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL;

-- Fix 2: If your project has these columns, uncomment and run (check auth.users columns first):
-- UPDATE auth.users SET email_change = COALESCE(email_change, '') WHERE email_change IS NULL;
-- UPDATE auth.users SET email_change_token_new = COALESCE(email_change_token_new, '') WHERE email_change_token_new IS NULL;

-- Fix 3: Ensure info@kleenapp.co.uk has admin role in profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, 'info@kleenapp.co.uk', COALESCE(raw_user_meta_data->>'full_name', 'Kleen Admin'), 'admin'
FROM auth.users WHERE email = 'info@kleenapp.co.uk'
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = 'info@kleenapp.co.uk';
