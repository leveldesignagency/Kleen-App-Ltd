-- ============================================================================
-- KLEEN — Migration 033: Fix infinite RLS recursion on jobs
--
-- Problem: Migration 032 added policies on jobs / job_details that use
-- EXISTS (SELECT ... FROM quote_requests ...). Evaluating quote_requests
-- applies RLS, including "Customers see quote requests for own job" (016),
-- which subqueries jobs — re-entering jobs RLS → infinite recursion.
--
-- Fix: SECURITY DEFINER helper that turns row_security off for the internal
-- EXISTS check only. The predicate still requires auth.uid() to match the
-- operative on the quote_request, so we do not expose other users' rows.
-- ============================================================================

create or replace function public.operative_has_quote_request_for_job(p_job_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Bypass RLS only for this boolean check so we do not recurse jobs ↔ quote_requests.
  set local row_security = off;
  return exists (
    select 1
    from public.quote_requests qr
    join public.operatives o on o.id = qr.operative_id
    where qr.job_id = p_job_id
      and o.user_id = auth.uid()
  );
end;
$$;

revoke all on function public.operative_has_quote_request_for_job(uuid) from public;
grant execute on function public.operative_has_quote_request_for_job(uuid) to authenticated;
grant execute on function public.operative_has_quote_request_for_job(uuid) to service_role;

-- Replace inline EXISTS policies with calls to the helper
drop policy if exists "Operatives see jobs from quote requests" on public.jobs;
create policy "Operatives see jobs from quote requests"
  on public.jobs for select
  using (public.operative_has_quote_request_for_job(id));

drop policy if exists "Operatives see job_details for quoted jobs" on public.job_details;
create policy "Operatives see job_details for quoted jobs"
  on public.job_details for select
  using (public.operative_has_quote_request_for_job(job_id));
