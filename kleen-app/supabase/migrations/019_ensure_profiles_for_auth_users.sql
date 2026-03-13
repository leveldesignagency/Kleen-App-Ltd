-- ============================================================================
-- KLEEN — Migration 019: Ensure profiles for all auth users
-- Backfills public.profiles for any auth.users row that doesn't have one.
-- Use this if a user exists in Auth but their profile was missing (e.g. after
-- manual fixes or if they were created before handle_new_user ran).
-- Safe to run multiple times (no-op for users who already have a profile).
-- ============================================================================

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(u.email, '@', 1)
  ),
  coalesce(
    (u.raw_user_meta_data ->> 'role')::public.user_role,
    'customer'
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
