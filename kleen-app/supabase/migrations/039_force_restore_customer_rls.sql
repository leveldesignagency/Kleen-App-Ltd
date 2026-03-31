-- Force-restore customer-facing RLS policies (replaces broken or missing definitions).
-- Run after 037/038 if customer dashboard still returns no rows.
-- Uses DROP IF EXISTS + CREATE so definitions match production expectations.

-- Profiles
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid() or is_admin());

-- Jobs (customer owns row)
drop policy if exists "Users see own jobs" on public.jobs;
create policy "Users see own jobs"
  on public.jobs for select
  using (user_id = auth.uid() or is_admin());

-- Job details
drop policy if exists "Users see own job details" on public.job_details;
create policy "Users see own job details"
  on public.job_details for select using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id and (j.user_id = auth.uid() or is_admin())
    )
  );

-- Quotes
drop policy if exists "Users see own quotes" on public.quotes;
create policy "Users see own quotes"
  on public.quotes for select using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id and (j.user_id = auth.uid() or is_admin())
    )
  );

-- Quote pipeline (016)
drop policy if exists "Customers see quote requests for own job" on public.quote_requests;
create policy "Customers see quote requests for own job"
  on public.quote_requests for select using (
    exists (
      select 1 from public.jobs j
      where j.id = quote_requests.job_id and j.user_id = auth.uid()
    )
  );

drop policy if exists "Customers see quote responses for own job" on public.quote_responses;
create policy "Customers see quote responses for own job"
  on public.quote_responses for select using (
    exists (
      select 1 from public.quote_requests qr
      join public.jobs j on j.id = qr.job_id
      where qr.id = quote_responses.quote_request_id and j.user_id = auth.uid()
    )
  );

-- Payments
drop policy if exists "Users see own payments" on public.payments;
create policy "Users see own payments"
  on public.payments for select
  using (user_id = auth.uid() or is_admin());

-- Notifications
drop policy if exists "Users see own notifications" on public.notifications;
create policy "Users see own notifications"
  on public.notifications for select using (user_id = auth.uid());

-- Business profiles (account page)
drop policy if exists "Users can view own business profile" on public.business_profiles;
create policy "Users can view own business profile"
  on public.business_profiles for select using (user_id = auth.uid() or is_admin());
