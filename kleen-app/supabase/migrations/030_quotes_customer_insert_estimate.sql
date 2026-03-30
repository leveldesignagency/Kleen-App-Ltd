-- ============================================================================
-- KLEEN — Migration 030: Allow customers to insert initial quote estimate rows
-- Job flow (Step7) inserts into public.quotes when the customer submits a job.
-- Only SELECT and admin ALL existed before; this caused 403 on insert.
-- ============================================================================

create policy "Users create own job quote estimates"
  on public.quotes for insert
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = job_id and j.user_id = auth.uid()
    )
  );
