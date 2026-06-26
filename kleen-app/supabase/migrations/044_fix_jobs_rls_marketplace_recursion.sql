-- ============================================================================
-- KLEEN — Migration 044: Fix infinite RLS recursion from marketplace policies (043)
--
-- 043 policies on jobs/job_details/quote_requests subquery each other via RLS.
-- Use SECURITY DEFINER helpers with row_security off (same pattern as 033).
-- ============================================================================

create or replace function public.operative_can_browse_open_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.jobs j
    join public.operatives o on o.user_id = auth.uid()
    where j.id = p_job_id
      and j.status in ('pending', 'awaiting_quotes')
      and o.is_verified = true
      and o.is_active = true
      and not exists (
        select 1
        from public.quote_requests qr
        where qr.job_id = j.id and qr.operative_id = o.id
      )
  );
end;
$$;

create or replace function public.job_is_open_for_quotes(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and j.status in ('pending', 'awaiting_quotes')
  );
end;
$$;

create or replace function public.operative_can_self_apply_quote(
  p_operative_id uuid,
  p_job_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.operatives o
    where o.id = p_operative_id
      and o.user_id = auth.uid()
      and o.is_verified = true
      and o.is_active = true
  )
  and public.job_is_open_for_quotes(p_job_id);
end;
$$;

revoke all on function public.operative_can_browse_open_job(uuid) from public;
grant execute on function public.operative_can_browse_open_job(uuid) to authenticated;
grant execute on function public.operative_can_browse_open_job(uuid) to service_role;

revoke all on function public.job_is_open_for_quotes(uuid) from public;
grant execute on function public.job_is_open_for_quotes(uuid) to authenticated;
grant execute on function public.job_is_open_for_quotes(uuid) to service_role;

revoke all on function public.operative_can_self_apply_quote(uuid, uuid) from public;
grant execute on function public.operative_can_self_apply_quote(uuid, uuid) to authenticated;
grant execute on function public.operative_can_self_apply_quote(uuid, uuid) to service_role;

drop policy if exists "Verified operatives browse open jobs" on public.jobs;
create policy "Verified operatives browse open jobs"
  on public.jobs for select
  using (public.operative_can_browse_open_job(id));

drop policy if exists "Verified operatives see job_details for open jobs" on public.job_details;
create policy "Verified operatives see job_details for open jobs"
  on public.job_details for select
  using (public.operative_can_browse_open_job(job_id));

drop policy if exists "Verified operatives self-apply quote request" on public.quote_requests;
create policy "Verified operatives self-apply quote request"
  on public.quote_requests for insert
  with check (
    initiated_by = 'contractor'
    and public.operative_can_self_apply_quote(operative_id, job_id)
  );
