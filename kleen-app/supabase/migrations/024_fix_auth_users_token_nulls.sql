-- ============================================================================
-- KLEEN — Migration 024: Fix NULL token columns in auth.users
-- Supabase Auth fails with "Database error querying schema" on sign-in when
-- confirmation_token, recovery_token, or other token columns are NULL.
-- See: https://github.com/supabase/auth/issues/1940
-- ============================================================================

-- Required: these two columns must never be NULL
update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token     = coalesce(recovery_token, '')
where confirmation_token is null or recovery_token is null;

-- Optional: fix if your auth.users has these columns (Supabase version-dependent)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email_change_token_new') then
    update auth.users set email_change_token_new = coalesce(email_change_token_new, '') where email_change_token_new is null;
  end if;
end $$;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email_change') then
    update auth.users set email_change = coalesce(email_change, '') where email_change is null;
  end if;
end $$;
