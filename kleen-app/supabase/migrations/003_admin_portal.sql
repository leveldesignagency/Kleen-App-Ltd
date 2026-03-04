-- ============================================================================
-- KLEEN — Migration 003: Admin Portal
-- Run on top of 001 + 002
-- Adds: quote_request_status enum, quote_requests table, quote_responses table,
--        is_blocked on profiles, extra columns on operatives
-- ============================================================================

-- 1. New enum for quote request lifecycle
create type quote_request_status as enum ('sent', 'viewed', 'quoted', 'declined', 'expired');

-- 2. Add is_blocked to profiles (for banning customers)
alter table public.profiles
  add column if not exists is_blocked boolean not null default false;

-- 3. Enrich operatives table for contractor profiles
alter table public.operatives
  add column if not exists company_name  text,
  add column if not exists service_areas text[] default '{}',
  add column if not exists notes         text,
  add column if not exists is_verified   boolean not null default false,
  add column if not exists hourly_rate   int,
  add column if not exists updated_at    timestamptz not null default now();

-- 4. Quote requests — admin sends job specs to contractors
create table public.quote_requests (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs on delete cascade,
  operative_id    uuid not null references public.operatives on delete cascade,
  sent_by         uuid not null references public.profiles on delete set null,
  status          quote_request_status not null default 'sent',
  deadline        timestamptz not null,
  message         text,
  sent_at         timestamptz not null default now(),
  viewed_at       timestamptz,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (job_id, operative_id)
);

create index idx_qr_job on public.quote_requests (job_id);
create index idx_qr_operative on public.quote_requests (operative_id);
create index idx_qr_status on public.quote_requests (status);

-- 5. Quote responses — contractors submit their quotes
create table public.quote_responses (
  id                uuid primary key default gen_random_uuid(),
  quote_request_id  uuid not null unique references public.quote_requests on delete cascade,
  price_pence       int not null,
  estimated_hours   numeric(5,2),
  available_date    date,
  notes             text,
  created_at        timestamptz not null default now()
);

create index idx_qresp_request on public.quote_responses (quote_request_id);

-- 6. Triggers
create trigger trg_operatives_updated
  before update on public.operatives
  for each row execute function update_updated_at();

-- 7. RLS — quote_requests
alter table public.quote_requests enable row level security;

create policy "Admins manage quote requests"
  on public.quote_requests for all using (is_admin());

create policy "Operatives see own quote requests"
  on public.quote_requests for select using (
    exists (select 1 from public.operatives o where o.id = operative_id and o.user_id = auth.uid())
  );

create policy "Operatives can update own quote requests"
  on public.quote_requests for update using (
    exists (select 1 from public.operatives o where o.id = operative_id and o.user_id = auth.uid())
  );

-- 8. RLS — quote_responses
alter table public.quote_responses enable row level security;

create policy "Admins manage quote responses"
  on public.quote_responses for all using (is_admin());

create policy "Operatives manage own quote responses"
  on public.quote_responses for all using (
    exists (
      select 1 from public.quote_requests qr
      join public.operatives o on o.id = qr.operative_id
      where qr.id = quote_request_id and o.user_id = auth.uid()
    )
  );

-- 9. Seed admin user (password hashed via bcrypt by Supabase)
do $$
declare
  new_uid uuid := gen_random_uuid();
begin
  -- Only create if user doesn't already exist
  if not exists (select 1 from auth.users where email = 'ryan@kleen.co.uk') then
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      confirmation_token
    ) values (
      new_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'ryan@kleen.co.uk',
      crypt('ryanw1234', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Ryan W"}'::jsonb,
      ''
    );

    -- The handle_new_user trigger creates the profile row automatically.
    -- Update it to admin role.
    update public.profiles
    set role = 'admin', full_name = 'Ryan W'
    where id = new_uid;

    raise notice 'Admin user created: ryan@kleen.co.uk';
  else
    -- User exists, just ensure they're admin
    update public.profiles
    set role = 'admin'
    where email = 'ryan@kleen.co.uk';

    raise notice 'Admin role updated for existing user: ryan@kleen.co.uk';
  end if;
end $$;
