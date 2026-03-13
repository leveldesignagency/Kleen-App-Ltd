-- ============================================================================
-- KLEEN — Migration 020: Marketplace contracts & e-sign flow
-- Contractor: one contract per service attached to profile.
-- Quote: linked to operative_service so customer sees contract.
-- Customer: must e-sign contractor contract + accept Kleen T&Cs before payment.
-- ============================================================================

-- 1. Operative services: which services a contractor offers + their contract for that service
create table if not exists public.operative_services (
  id                uuid primary key default gen_random_uuid(),
  operative_id       uuid not null references public.operatives on delete cascade,
  service_id         text not null references public.services on delete cascade,
  contract_title     text,
  contract_content   text,
  contract_file_url  text,
  contract_version   int not null default 1,
  is_active          boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (operative_id, service_id)
);

create index idx_operative_services_operative on public.operative_services (operative_id);
create index idx_operative_services_service on public.operative_services (service_id);

create trigger trg_operative_services_updated
  before update on public.operative_services
  for each row execute function update_updated_at();

-- 2. Link quote response to the operative's service contract used for this quote
alter table public.quote_responses
  add column if not exists operative_service_id uuid references public.operative_services on delete set null;

create index idx_quote_responses_operative_service on public.quote_responses (operative_service_id);

-- 3. Customer e-signature of contractor's service contract (per job + quote)
create table if not exists public.customer_contract_signatures (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.jobs on delete cascade,
  quote_request_id   uuid not null references public.quote_requests on delete cascade,
  operative_service_id uuid not null references public.operative_services on delete restrict,
  user_id             uuid not null references public.profiles on delete cascade,
  signed_at           timestamptz not null default now(),
  signer_name         text not null,
  signer_email        text,
  ip_address          inet,
  signature_data      text,
  created_at          timestamptz not null default now(),
  unique (job_id, quote_request_id)
);

create index idx_customer_contract_signatures_job on public.customer_contract_signatures (job_id);
create index idx_customer_contract_signatures_user on public.customer_contract_signatures (user_id);

-- 4. Customer acceptance of Kleen platform terms & conditions (per job)
create table if not exists public.kleen_terms_acceptances (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs on delete cascade,
  user_id       uuid not null references public.profiles on delete cascade,
  accepted_at   timestamptz not null default now(),
  terms_version text not null default '1.0',
  ip_address    inet,
  created_at    timestamptz not null default now(),
  unique (job_id, user_id)
);

create index idx_kleen_terms_acceptances_job on public.kleen_terms_acceptances (job_id);
create index idx_kleen_terms_acceptances_user on public.kleen_terms_acceptances (user_id);

-- 5. Optional: quick checks on jobs (can derive from tables above)
alter table public.jobs
  add column if not exists customer_contract_signed_at timestamptz,
  add column if not exists kleen_terms_accepted_at timestamptz;

-- RLS
alter table public.operative_services enable row level security;

create policy "Admins manage operative_services"
  on public.operative_services for all using (is_admin());

create policy "Operatives see own operative_services"
  on public.operative_services for select using (
    exists (select 1 from public.operatives o where o.id = operative_id and o.user_id = auth.uid())
  );

-- Customers see operative_services only via quote (we expose contract content in API or when loading quote)
create policy "Service read for quote"
  on public.operative_services for select using (
    exists (
      select 1 from public.quote_responses qr
      join public.quote_requests qreq on qreq.id = qr.quote_request_id
      join public.jobs j on j.id = qreq.job_id
      where qr.operative_service_id = operative_services.id and j.user_id = auth.uid()
    )
  );

alter table public.customer_contract_signatures enable row level security;

create policy "Customers manage own contract signatures"
  on public.customer_contract_signatures for all using (user_id = auth.uid());

create policy "Admins see all contract signatures"
  on public.customer_contract_signatures for select using (is_admin());

create policy "Customers insert own contract signatures"
  on public.customer_contract_signatures for insert with check (user_id = auth.uid());

alter table public.kleen_terms_acceptances enable row level security;

create policy "Customers manage own terms acceptances"
  on public.kleen_terms_acceptances for all using (user_id = auth.uid());

create policy "Admins see all terms acceptances"
  on public.kleen_terms_acceptances for select using (is_admin());

create policy "Customers insert own terms acceptances"
  on public.kleen_terms_acceptances for insert with check (user_id = auth.uid());
