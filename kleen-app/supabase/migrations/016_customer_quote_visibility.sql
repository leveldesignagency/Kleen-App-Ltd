-- ============================================================================
-- KLEEN — Migration 016: Customer quote visibility
-- Customers must be able to read quote_requests and quote_responses for their
-- own jobs so the dashboard can show "Quotes Available" and the quote options
-- when admin has sent quotes to customer.
--
-- ** You must run this migration for customer dashboard quotes to work. **
-- Without it, customers will see "Quotes should appear here" but no quote cards.
-- ============================================================================

-- Customers can SELECT quote_requests for jobs they own
create policy "Customers see quote requests for own job"
  on public.quote_requests for select using (
    exists (
      select 1 from public.jobs j
      where j.id = quote_requests.job_id and j.user_id = auth.uid()
    )
  );

-- Customers can SELECT quote_responses for quote_requests on their jobs
create policy "Customers see quote responses for own job"
  on public.quote_responses for select using (
    exists (
      select 1 from public.quote_requests qr
      join public.jobs j on j.id = qr.job_id
      where qr.id = quote_responses.quote_request_id and j.user_id = auth.uid()
    )
  );
