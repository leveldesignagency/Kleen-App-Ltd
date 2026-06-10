-- Contractor job marketplace — run in Supabase SQL Editor after contractor_apply_flow.sql

alter table public.operatives
  add column if not exists base_postcode text,
  add column if not exists max_travel_radius_miles int not null default 25;

alter table public.quote_requests
  add column if not exists initiated_by text not null default 'admin';

alter table public.quote_requests
  alter column sent_by drop not null;

drop policy if exists "Verified operatives browse open jobs" on public.jobs;
create policy "Verified operatives browse open jobs"
  on public.jobs for select
  using (
    status in ('pending', 'awaiting_quotes')
    and exists (
      select 1 from public.operatives o
      where o.user_id = auth.uid() and o.is_verified = true and o.is_active = true
    )
    and not exists (
      select 1 from public.quote_requests qr
      join public.operatives o on o.id = qr.operative_id
      where qr.job_id = jobs.id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Verified operatives see job_details for open jobs" on public.job_details;
create policy "Verified operatives see job_details for open jobs"
  on public.job_details for select
  using (
    exists (
      select 1 from public.jobs j
      join public.operatives o on o.user_id = auth.uid() and o.is_verified = true and o.is_active = true
      where j.id = job_details.job_id
        and j.status in ('pending', 'awaiting_quotes')
        and not exists (
          select 1 from public.quote_requests qr
          where qr.job_id = j.id and qr.operative_id = o.id
        )
    )
  );

drop policy if exists "Verified operatives self-apply quote request" on public.quote_requests;
create policy "Verified operatives self-apply quote request"
  on public.quote_requests for insert
  with check (
    initiated_by = 'contractor'
    and exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid() and o.is_verified = true and o.is_active = true
    )
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.status in ('pending', 'awaiting_quotes')
    )
  );
