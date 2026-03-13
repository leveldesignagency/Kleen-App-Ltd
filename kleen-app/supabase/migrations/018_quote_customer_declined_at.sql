-- ============================================================================
-- KLEEN — Migration 018: Customer decline per quote
-- Customer can decline individual quotes. When they accept one, all others
-- are auto-declined. customer_declined_at records when the customer declined.
-- ============================================================================

alter table public.quote_requests
  add column if not exists customer_declined_at timestamptz;

-- Customers can update quote_requests for their own job (to set customer_declined_at)
create policy "Customers can update quote requests for own job"
  on public.quote_requests for update using (
    exists (
      select 1 from public.jobs j
      where j.id = quote_requests.job_id and j.user_id = auth.uid()
    )
  );
