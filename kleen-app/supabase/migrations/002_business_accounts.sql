-- ============================================================================
-- KLEEN — Migration 002: Business Accounts
-- Run this on top of 001_full_schema.sql
-- Adds: account_type enum, account_type column on profiles,
--        business_profiles table + RLS
-- ============================================================================

-- 1. New enum
create type account_type as enum ('personal', 'business');

-- 2. Add column to existing profiles table
alter table public.profiles
  add column account_type account_type not null default 'personal';

create index idx_profiles_account_type on public.profiles (account_type);

-- 3. Business profiles table
create table public.business_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public.profiles on delete cascade,
  company_name        text not null,
  company_number      text,
  vat_number          text,
  billing_email       text,
  billing_address_id  uuid,
  industry            text,
  employee_count      text,
  website             text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_bp_user on public.business_profiles (user_id);

-- 4. Auto-update timestamp trigger
create trigger trg_bp_updated
  before update on public.business_profiles
  for each row execute function update_updated_at();

-- 5. RLS
alter table public.business_profiles enable row level security;

create policy "Users can view own business profile"
  on public.business_profiles for select using (user_id = auth.uid() or is_admin());

create policy "Users can manage own business profile"
  on public.business_profiles for all using (user_id = auth.uid() or is_admin());
