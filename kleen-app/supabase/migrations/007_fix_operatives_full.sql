-- ============================================================================
-- KLEEN — Migration 007: Ensure operatives table is fully up to date
-- Safe to run even if 003 and 006 were already applied
-- Adds all missing columns and the contractor_type enum if not present
-- ============================================================================

-- 1. Create contractor_type enum if it doesn't exist
do $$
begin
  if not exists (select 1 from pg_type where typname = 'contractor_type') then
    create type contractor_type as enum ('sole_trader', 'business');
  end if;
end $$;

-- 2. Add all columns that may be missing from operatives
alter table public.operatives
  add column if not exists company_name     text,
  add column if not exists service_areas    text[] default '{}',
  add column if not exists notes            text,
  add column if not exists is_verified      boolean not null default false,
  add column if not exists hourly_rate      int,
  add column if not exists updated_at       timestamptz not null default now(),
  add column if not exists contractor_type  contractor_type not null default 'sole_trader',
  -- Banking & financial details (for Stripe payouts)
  add column if not exists bank_account_name   text,
  add column if not exists bank_sort_code      text,
  add column if not exists bank_account_number text,
  add column if not exists company_number      text,
  add column if not exists vat_number          text,
  add column if not exists utr_number          text,
  add column if not exists stripe_account_id   text;

-- 3. Ensure the updated_at trigger exists
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_operatives_updated'
  ) then
    create trigger trg_operatives_updated
      before update on public.operatives
      for each row execute function update_updated_at();
  end if;
end $$;

-- 4. Verify RLS is enabled and admin policy exists
alter table public.operatives enable row level security;

-- Drop and recreate admin policy to be safe (idempotent)
drop policy if exists "Admins manage operatives" on public.operatives;
create policy "Admins manage operatives"
  on public.operatives for all using (is_admin());

drop policy if exists "Operatives see own record" on public.operatives;
create policy "Operatives see own record"
  on public.operatives for select using (user_id = auth.uid());

-- 5. Grant usage on the enum to authenticated users
grant usage on type contractor_type to authenticated;
