-- Hotfix: restore core customer visibility policies (idempotent).
-- This is additive and only creates missing policies.

alter table if exists public.profiles enable row level security;
alter table if exists public.jobs enable row level security;
alter table if exists public.job_details enable row level security;
alter table if exists public.quotes enable row level security;
alter table if exists public.quote_requests enable row level security;
alter table if exists public.quote_responses enable row level security;
alter table if exists public.payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users read own profile'
  ) then
    create policy "Users read own profile"
      on public.profiles for select
      using (id = auth.uid() or is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'Users see own jobs'
  ) then
    create policy "Users see own jobs"
      on public.jobs for select
      using (user_id = auth.uid() or is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'job_details' and policyname = 'Users see own job details'
  ) then
    create policy "Users see own job details"
      on public.job_details for select using (
        exists (
          select 1 from public.jobs j
          where j.id = job_id and (j.user_id = auth.uid() or is_admin())
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quotes' and policyname = 'Users see own quotes'
  ) then
    create policy "Users see own quotes"
      on public.quotes for select using (
        exists (
          select 1 from public.jobs j
          where j.id = job_id and (j.user_id = auth.uid() or is_admin())
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quote_requests' and policyname = 'Customers see quote requests for own job'
  ) then
    create policy "Customers see quote requests for own job"
      on public.quote_requests for select using (
        exists (
          select 1 from public.jobs j
          where j.id = quote_requests.job_id and j.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quote_responses' and policyname = 'Customers see quote responses for own job'
  ) then
    create policy "Customers see quote responses for own job"
      on public.quote_responses for select using (
        exists (
          select 1 from public.quote_requests qr
          join public.jobs j on j.id = qr.job_id
          where qr.id = quote_responses.quote_request_id and j.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payments' and policyname = 'Users see own payments'
  ) then
    create policy "Users see own payments"
      on public.payments for select
      using (user_id = auth.uid() or is_admin());
  end if;
end $$;
