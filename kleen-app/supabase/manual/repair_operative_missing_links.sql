-- =============================================================================
-- Repair: auth user has profile.role = operative but no operatives row
-- (query 6 from diagnose_contractor_jobs.sql)
--
-- Run sections in order. Read results before running destructive fixes.
-- =============================================================================

-- A) What operatives exist at all? (who has the quotes?)
select
  o.id,
  o.email,
  o.user_id,
  o.full_name,
  o.onboarding_source,
  o.is_verified,
  (select count(*) from public.quote_requests qr where qr.operative_id = o.id) as quotes,
  (select count(*) from public.job_assignments ja where ja.operative_id = o.id) as assignments
from public.operatives o
order by quotes desc, assignments desc, o.created_at desc;

-- B) Accepted jobs + which operative email owns them
select
  j.reference,
  j.status,
  o.id as operative_id,
  o.email as contractor_email,
  o.user_id,
  o.full_name,
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = j.id and ja.operative_id = o.id
  ) as has_assignment
from public.jobs j
join public.quote_requests qr on qr.id = j.accepted_quote_request_id
join public.operatives o on o.id = qr.operative_id
where j.accepted_quote_request_id is not null
order by j.customer_accepted_at desc nulls last;

-- C) Create missing operatives rows for Google sign-ups (safe — skips if email exists)
insert into public.operatives (
  user_id, email, full_name, contractor_type, specialisations, service_areas,
  is_active, is_verified, onboarding_source
)
select
  u.id,
  lower(trim(u.email)),
  coalesce(nullif(trim(p.full_name), ''), split_part(u.email, '@', 1), 'Contractor'),
  'sole_trader',
  '{}',
  '{}',
  true,
  false,
  'self_apply'
from auth.users u
join public.profiles p on p.id = u.id
where p.role = 'operative'
  and not exists (select 1 from public.operatives o where o.user_id = u.id)
  and not exists (
    select 1 from public.operatives o where lower(trim(o.email)) = lower(trim(u.email))
  );

-- D) LINK portal login to the admin contractor that has the job
--    Replace BOTH values, then run ONLY this block after checking (A) and (B).
--
--    auth_email     = email you sign into contractor portal with
--    contractor_email = email on the operative row that has quotes (from query B)

/*
do $$
declare
  v_auth_id uuid;
  v_operative_id uuid;
  v_auth_email text := 'charlesstephenmorgan@gmail.com';
  v_contractor_email text := 'PUT_EMAIL_FROM_QUERY_B_HERE';
begin
  select id into v_auth_id from auth.users where lower(trim(email)) = lower(trim(v_auth_email)) limit 1;
  select id into v_operative_id from public.operatives where lower(trim(email)) = lower(trim(v_contractor_email)) limit 1;

  if v_auth_id is null then
    raise exception 'No auth user for %', v_auth_email;
  end if;
  if v_operative_id is null then
    raise exception 'No operative for %', v_contractor_email;
  end if;

  -- Deactivate empty self_apply row if portal already created one for auth user
  update public.operatives
  set is_active = false, user_id = null
  where user_id = v_auth_id and id <> v_operative_id;

  update public.operatives
  set
    user_id = v_auth_id,
    email = lower(trim(v_auth_email)),
    is_active = true
  where id = v_operative_id;

  raise notice 'Linked operative % to auth user %', v_operative_id, v_auth_id;
end $$;
*/

-- E) Backfill assignments for accepted jobs (if has_assignment = false in B)
insert into public.job_assignments (job_id, operative_id, assigned_at)
select
  j.id,
  qr.operative_id,
  coalesce(j.customer_accepted_at, j.updated_at, now())
from public.jobs j
join public.quote_requests qr on qr.id = j.accepted_quote_request_id
where j.accepted_quote_request_id is not null
  and qr.operative_id is not null
  and not exists (
    select 1 from public.job_assignments ja
    where ja.job_id = j.id and ja.operative_id = qr.operative_id
  )
on conflict (job_id, operative_id) do nothing;
