-- =============================================================================
-- Diagnose contractor "0 jobs" — run in Supabase SQL editor.
--
-- STEP A: Replace the email on the line marked >>> below, run query (1) only.
-- If (1) returns no rows, run queries (2)–(5) without changing anything else.
-- =============================================================================

-- >>> SET YOUR CONTRACTOR SIGN-IN EMAIL HERE (same as Google / contractor portal):
-- e.g. 'ryan@kleen.co.uk'

-- (1) Does this person exist in auth + operatives?
select
  u.id as auth_user_id,
  u.email as auth_email,
  p.role as profile_role,
  o.id as operative_id,
  o.email as operative_email,
  o.user_id as operative_user_id,
  o.full_name,
  o.onboarding_source,
  o.is_verified,
  o.is_active,
  (select count(*) from public.quote_requests qr where qr.operative_id = o.id) as quote_requests,
  (select count(*) from public.job_assignments ja where ja.operative_id = o.id) as assignments
from auth.users u
left join public.profiles p on p.id = u.id
left join public.operatives o on o.user_id = u.id
   or lower(trim(o.email)) = lower(trim(u.email))
where lower(trim(u.email)) = lower(trim('YOUR_EMAIL@example.com'));

-- (2) ANY operative row with similar email (typo / plus-address / wrong domain?)
select id, user_id, email, full_name, onboarding_source, is_verified, is_active, created_at
from public.operatives
where email ilike '%YOUR_EMAIL%'   -- replace with the local part, e.g. '%ryan%'
   or email ilike '%example.com%'   -- replace with domain part if needed
order by created_at desc;

-- (3) All operatives that actually have quotes or assignments (last 30 days activity)
select
  o.id,
  o.email,
  o.user_id,
  o.full_name,
  o.is_verified,
  count(distinct qr.id) as quote_requests,
  count(distinct ja.id) as assignments
from public.operatives o
left join public.quote_requests qr on qr.operative_id = o.id
left join public.job_assignments ja on ja.operative_id = o.id
group by o.id, o.email, o.user_id, o.full_name, o.is_verified
having count(distinct qr.id) > 0 or count(distinct ja.id) > 0
order by count(distinct qr.id) + count(distinct ja.id) desc;

-- (4) Every job with a customer-accepted quote (regardless of contractor email)
select
  j.reference,
  j.status,
  j.customer_accepted_at,
  j.accepted_quote_request_id,
  qr.operative_id,
  o.email as contractor_email,
  o.user_id as contractor_user_id,
  o.full_name as contractor_name,
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = j.id and ja.operative_id = qr.operative_id
  ) as has_assignment,
  cust.email as customer_auth_email
from public.jobs j
join public.quote_requests qr on qr.id = j.accepted_quote_request_id
join public.operatives o on o.id = qr.operative_id
left join auth.users cust on cust.id = j.user_id
where j.accepted_quote_request_id is not null
order by j.customer_accepted_at desc nulls last
limit 20;

-- (5) Duplicate operatives (same email, different rows) — run migration 055 if any rows
select lower(trim(email)) as email_norm, count(*) as rows, array_agg(id::text) as operative_ids
from public.operatives
where email is not null and trim(email) <> ''
group by lower(trim(email))
having count(*) > 1
order by count(*) desc;

-- (6) Auth users with role operative but NO operatives.user_id link
select
  u.email,
  u.id as auth_user_id,
  p.role,
  (select count(*) from public.operatives o where o.user_id = u.id) as linked_operatives,
  (select count(*) from public.operatives o where lower(trim(o.email)) = lower(trim(u.email))) as email_match_operatives
from auth.users u
join public.profiles p on p.id = u.id
where p.role = 'operative'
  and not exists (select 1 from public.operatives o where o.user_id = u.id)
order by u.created_at desc
limit 20;
