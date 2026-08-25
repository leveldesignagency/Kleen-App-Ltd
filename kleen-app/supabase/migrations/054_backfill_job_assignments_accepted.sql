-- ============================================================================
-- KLEEN — Migration 054: Backfill job_assignments for accepted quotes
--
-- Early ops / missing trigger 017: jobs with accepted_quote_request_id but no
-- job_assignments row never appeared on the contractor Assigned tab.
-- ============================================================================

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
    select 1
    from public.job_assignments ja
    where ja.job_id = j.id
      and ja.operative_id = qr.operative_id
  )
on conflict (job_id, operative_id) do nothing;
