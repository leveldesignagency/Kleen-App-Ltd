-- ============================================================================
-- KLEEN — Migration 028: Operative field portal + escrow (authorized vs captured)
-- ============================================================================

-- Payment held (authorized) before capture — complements payment_captured_at
alter table public.jobs
  add column if not exists payment_authorized_at timestamptz;

-- Secure link for contractor job status (no login)
alter table public.jobs
  add column if not exists operative_portal_token text unique;

alter table public.jobs
  add column if not exists operative_portal_token_created_at timestamptz;

-- Field workflow timestamps (set via public contractor portal)
alter table public.jobs
  add column if not exists operative_en_route_at timestamptz,
  add column if not exists operative_arrived_at timestamptz,
  add column if not exists operative_marked_complete_at timestamptz,
  add column if not exists operative_marked_incomplete_at timestamptz,
  add column if not exists operative_incomplete_reason text;

create index if not exists idx_jobs_operative_portal_token on public.jobs (operative_portal_token)
  where operative_portal_token is not null;

-- Optional: authorized payment state for Stripe manual capture
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'payment_status' and e.enumlabel = 'authorized'
  ) then
    alter type public.payment_status add value 'authorized';
  end if;
exception
  when duplicate_object then null;
end $$;
