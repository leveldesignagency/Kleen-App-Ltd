-- =============================================================================
-- Contractor apply flow — run once in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================================

-- 034 + 036: verification, rejection, UK fields, review queue
alter table public.operatives
  add column if not exists verified_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_message text,
  add column if not exists trading_name text,
  add column if not exists registered_address text,
  add column if not exists submitted_for_review_at timestamptz;

create index if not exists idx_operatives_submitted_for_review_at
  on public.operatives (submitted_for_review_at);

-- 042: contractors cannot self-set is_verified / verified_at
create or replace function public.operatives_guard_verification_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(auth.jwt() ->> 'role', '');

  if jwt_role = 'service_role' then
    return new;
  end if;

  if auth.uid() is not null and auth.uid() = old.user_id then
    new.is_verified := old.is_verified;
    new.verified_at := old.verified_at;
  end if;

  return new;
end;
$$;

drop trigger if exists operatives_guard_verification_on_update on public.operatives;
create trigger operatives_guard_verification_on_update
  before update on public.operatives
  for each row
  execute function public.operatives_guard_verification_on_update();
