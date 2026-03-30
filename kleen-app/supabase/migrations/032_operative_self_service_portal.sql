-- ============================================================================
-- KLEEN — Migration 032: Operative self-service portal (RLS)
-- Contractors signed in with profiles.role = 'operative' can:
-- - Insert exactly one operatives row (user_id = auth.uid())
-- - Update their own operatives row
-- - Manage operative_services for their operative
-- - See jobs they were invited to quote on (quote_requests), plus assigned jobs
-- - See job_details for those jobs
-- ============================================================================

-- ── operatives: self-register and edit own profile (admin policy remains) ─────
drop policy if exists "Operatives insert own profile once" on public.operatives;
create policy "Operatives insert own profile once"
  on public.operatives for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.operatives o2 where o2.user_id = auth.uid()
    )
  );

drop policy if exists "Operatives update own profile" on public.operatives;
create policy "Operatives update own profile"
  on public.operatives for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── operative_services: CRUD own rows (admin + existing select policies stay) ─
drop policy if exists "Operatives insert own operative_services" on public.operative_services;
create policy "Operatives insert own operative_services"
  on public.operative_services for insert
  with check (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Operatives update own operative_services" on public.operative_services;
create policy "Operatives update own operative_services"
  on public.operative_services for update
  using (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Operatives delete own operative_services" on public.operative_services;
create policy "Operatives delete own operative_services"
  on public.operative_services for delete
  using (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  );

-- ── jobs: see jobs where this operative has a quote request (pipeline) ────────
drop policy if exists "Operatives see jobs from quote requests" on public.jobs;
create policy "Operatives see jobs from quote requests"
  on public.jobs for select
  using (
    exists (
      select 1 from public.quote_requests qr
      join public.operatives o on o.id = qr.operative_id
      where qr.job_id = jobs.id and o.user_id = auth.uid()
    )
  );

-- ── job_details: read for quoted jobs ─────────────────────────────────────────
drop policy if exists "Operatives see job_details for quoted jobs" on public.job_details;
create policy "Operatives see job_details for quoted jobs"
  on public.job_details for select
  using (
    exists (
      select 1 from public.quote_requests qr
      join public.operatives o on o.id = qr.operative_id
      where qr.job_id = job_details.job_id and o.user_id = auth.uid()
    )
  );
