-- Remove unauthorized test sign-ups (run in Supabase SQL Editor).
-- Review the list first: uncomment the SELECT before running DELETE.
--
-- UK GDPR: lawful to delete mistaken/pre-launch sign-ups you do not need.
-- Keep info@kleenapp.co.uk and any real customers you intend to serve.

-- 1) Preview who would be removed (customers only, not admins/operatives)
select
  u.id,
  u.email,
  u.created_at,
  p.role
from auth.users u
join public.profiles p on p.id = u.id
where p.role = 'customer'
  and u.email is distinct from 'info@kleenapp.co.uk'
order by u.created_at desc;

-- 2) Delete selected users (Supabase removes auth.users; profiles cascade if FK is set)
-- Replace the email list or use created_at cutoff for pre-launch accounts.
/*
delete from auth.users
where id in (
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.role = 'customer'
    and u.created_at < '2026-06-26'::timestamptz
    and u.email is distinct from 'info@kleenapp.co.uk'
);
*/

-- Or delete one user by email in Dashboard: Authentication → Users → ⋯ → Delete user
