-- Contractor rates customer behaviour per job (1 row per job).
-- Additive only: no DROP POLICY; FKs use RESTRICT on profiles/operatives (no cascade deletes from parent rows).
-- job_id CASCADE: removing a job removes its rating row (data is job-scoped).

create table if not exists public.job_customer_ratings (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null unique references public.jobs on delete cascade,
  operative_id      uuid not null references public.operatives on delete restrict,
  customer_user_id  uuid not null references public.profiles on delete restrict,
  rating            smallint not null check (rating between 1 and 5),
  comment           text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_job_customer_ratings_operative on public.job_customer_ratings (operative_id);
create index if not exists idx_job_customer_ratings_customer on public.job_customer_ratings (customer_user_id);

alter table public.job_customer_ratings enable row level security;

-- Policies: create only if missing (safe if SQL is re-run manually).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_customer_ratings'
      and policyname = 'Admins manage job customer ratings'
  ) then
    create policy "Admins manage job customer ratings"
      on public.job_customer_ratings for all using (is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_customer_ratings'
      and policyname = 'Operatives insert rating for assigned job'
  ) then
    create policy "Operatives insert rating for assigned job"
      on public.job_customer_ratings for insert
      with check (
        exists (
          select 1
          from public.jobs j
          join public.job_assignments ja on ja.job_id = j.id
          join public.operatives o on o.id = ja.operative_id
          where j.id = job_customer_ratings.job_id
            and j.user_id = job_customer_ratings.customer_user_id
            and o.id = job_customer_ratings.operative_id
            and o.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_customer_ratings'
      and policyname = 'Operatives see own customer ratings'
  ) then
    create policy "Operatives see own customer ratings"
      on public.job_customer_ratings for select
      using (
        exists (select 1 from public.operatives o where o.id = operative_id and o.user_id = auth.uid())
        or is_admin()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_customer_ratings'
      and policyname = 'Customers see rating about them'
  ) then
    create policy "Customers see rating about them"
      on public.job_customer_ratings for select
      using (customer_user_id = auth.uid() or is_admin());
  end if;
end $$;
