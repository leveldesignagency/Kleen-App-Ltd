-- Audit user activity — who has jobs, quotes, contractor profiles, etc.
-- Run in Supabase SQL Editor. Allowed test user: charles@leveldesignagency.com

-- ── 1) Summary: every auth user + activity counts ─────────────────────────────
with allowed as (
  select lower('charles@leveldesignagency.com') as email
)
select
  u.email,
  p.role,
  u.created_at as signed_up_at,
  count(distinct j.id) as jobs_posted,
  count(distinct pay.id) as payments,
  count(distinct rs.id) as recurring_schedules,
  count(distinct d.id) as disputes_raised,
  count(distinct o.id) as operative_profiles,
  count(distinct qr_as_customer.job_id) as jobs_with_quote_requests,
  count(distinct qr_as_contractor.id) as contractor_quote_requests,
  count(distinct ja.id) as job_assignments
from auth.users u
join public.profiles p on p.id = u.id
left join public.jobs j on j.user_id = u.id
left join public.payments pay on pay.user_id = u.id
left join public.recurring_schedules rs on rs.user_id = u.id
left join public.disputes d on d.user_id = u.id
left join public.operatives o on o.user_id = u.id
left join public.jobs qr_as_customer on qr_as_customer.user_id = u.id
left join public.quote_requests qr_as_contractor on qr_as_contractor.operative_id = o.id
left join public.job_assignments ja on ja.operative_id = o.id
group by u.email, p.role, u.created_at
order by
  case when lower(u.email) = (select email from allowed) then 0 else 1 end,
  greatest(
    count(distinct j.id),
    count(distinct o.id),
    count(distinct qr_as_contractor.id)
  ) desc,
  u.created_at desc;


-- ── 2) Anyone OTHER than charles with any activity? (should be empty) ───────
with allowed as (
  select lower('charles@leveldesignagency.com') as email
)
select
  u.email,
  p.role,
  'jobs' as activity,
  count(*)::bigint as count
from auth.users u
join public.profiles p on p.id = u.id
join public.jobs j on j.user_id = u.id
where lower(u.email) <> (select email from allowed)
group by u.email, p.role

union all

select u.email, p.role, 'operative_profile', count(*)
from auth.users u
join public.profiles p on p.id = u.id
join public.operatives o on o.user_id = u.id
where lower(u.email) <> (select email from allowed)
group by u.email, p.role

union all

select u.email, p.role, 'contractor_quote_request', count(*)
from auth.users u
join public.profiles p on p.id = u.id
join public.operatives o on o.user_id = u.id
join public.quote_requests qr on qr.operative_id = o.id
where lower(u.email) <> (select email from allowed)
group by u.email, p.role

union all

select u.email, p.role, 'payment', count(*)
from auth.users u
join public.profiles p on p.id = u.id
join public.payments pay on pay.user_id = u.id
where lower(u.email) <> (select email from allowed)
group by u.email, p.role

union all

select u.email, p.role, 'recurring_schedule', count(*)
from auth.users u
join public.profiles p on p.id = u.id
join public.recurring_schedules rs on rs.user_id = u.id
where lower(u.email) <> (select email from allowed)
group by u.email, p.role

union all

select u.email, p.role, 'dispute', count(*)
from auth.users u
join public.profiles p on p.id = u.id
join public.disputes d on d.user_id = u.id
where lower(u.email) <> (select email from allowed)
group by u.email, p.role

order by count desc, email;


-- ── 3) Detail: jobs posted by non-charles users ─────────────────────────────
select
  u.email,
  j.reference,
  j.status,
  j.postcode,
  j.created_at
from public.jobs j
join public.profiles p on p.id = j.user_id
join auth.users u on u.id = p.id
where lower(u.email) <> lower('charles@leveldesignagency.com')
order by j.created_at desc;


-- ── 4) Detail: contractor / operative signups (non-charles) ─────────────────
select
  u.email,
  p.role,
  o.full_name,
  o.is_verified,
  o.is_active,
  o.submitted_for_review_at,
  o.created_at
from public.operatives o
join public.profiles p on p.id = o.user_id
join auth.users u on u.id = p.id
where lower(u.email) <> lower('charles@leveldesignagency.com')
order by o.created_at desc;


-- ── 5) All users with zero activity (safe delete candidates) ────────────────
select
  u.id,
  u.email,
  p.role,
  u.created_at
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) <> lower('charles@leveldesignagency.com')
  and not exists (select 1 from public.jobs j where j.user_id = u.id)
  and not exists (select 1 from public.operatives o where o.user_id = u.id)
  and not exists (select 1 from public.payments pay where pay.user_id = u.id)
  and not exists (select 1 from public.recurring_schedules rs where rs.user_id = u.id)
  and not exists (select 1 from public.disputes d where d.user_id = u.id)
order by u.created_at desc;
