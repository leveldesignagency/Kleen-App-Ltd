-- ============================================================================
-- KLEEN — Migration 010: Operatives banking, financial and contractor_type
-- Ensures operatives has bank_*, contractor_type and other columns so admin
-- contractor save works. Safe if 006/007 already applied.
-- ============================================================================

-- 1. Create contractor_type enum if it doesn't exist
do $$
begin
  if not exists (select 1 from pg_type where typname = 'contractor_type') then
    create type contractor_type as enum ('sole_trader', 'business');
  end if;
end $$;

-- 2. Add all columns that may be missing (idempotent)
alter table public.operatives
  add column if not exists company_name         text,
  add column if not exists service_areas        text[] default '{}',
  add column if not exists notes                text,
  add column if not exists is_verified          boolean not null default false,
  add column if not exists hourly_rate          int,
  add column if not exists updated_at           timestamptz not null default now(),
  add column if not exists contractor_type     contractor_type not null default 'sole_trader',
  add column if not exists bank_account_name   text,
  add column if not exists bank_sort_code      text,
  add column if not exists bank_account_number text,
  add column if not exists company_number      text,
  add column if not exists vat_number          text,
  add column if not exists utr_number         text,
  add column if not exists stripe_account_id   text;

grant usage on type contractor_type to authenticated;
