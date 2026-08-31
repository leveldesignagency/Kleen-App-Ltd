-- ============================================================================
-- KLEEN — Migration 062: Verified phone numbers + auth audit fields
-- Phone numbers on profiles/operatives are contact fields until verified via OTP.
-- ============================================================================

alter table public.profiles
  add column if not exists phone_e164 text,
  add column if not exists phone_verified_at timestamptz;

alter table public.operatives
  add column if not exists phone_e164 text,
  add column if not exists phone_verified_at timestamptz;

create index if not exists idx_profiles_phone_verified
  on public.profiles (phone_verified_at)
  where phone_verified_at is not null;

create index if not exists idx_operatives_phone_verified
  on public.operatives (phone_verified_at)
  where phone_verified_at is not null;

-- Clear verification when the stored number changes
create or replace function public.clear_profile_phone_verified()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(new.phone_e164, '') is distinct from coalesce(old.phone_e164, '')
       or coalesce(new.phone, '') is distinct from coalesce(old.phone, '') then
      new.phone_verified_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_profile_phone_verified on public.profiles;
create trigger trg_clear_profile_phone_verified
  before update on public.profiles
  for each row
  execute function public.clear_profile_phone_verified();

create or replace function public.clear_operative_phone_verified()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(new.phone_e164, '') is distinct from coalesce(old.phone_e164, '')
       or coalesce(new.phone, '') is distinct from coalesce(old.phone, '') then
      new.phone_verified_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_operative_phone_verified on public.operatives;
create trigger trg_clear_operative_phone_verified
  before update on public.operatives
  for each row
  execute function public.clear_operative_phone_verified();

create or replace function public.user_has_verified_phone(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.phone_verified_at is not null
  );
$$;

comment on function public.user_has_verified_phone is
  'True when the user has completed SMS OTP verification on their profile phone.';
