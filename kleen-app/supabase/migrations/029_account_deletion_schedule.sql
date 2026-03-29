-- ============================================================================
-- KLEEN — Migration 029: Scheduled account deletion (30-day grace)
-- Request/cancel via SECURITY DEFINER RPCs so users cannot forge dates via RLS.
-- Actual auth user removal runs from kleen-app cron + Supabase Admin API.
-- ============================================================================

alter table public.profiles
  add column if not exists account_deletion_requested_at timestamptz,
  add column if not exists account_deletion_scheduled_at timestamptz;

create index if not exists idx_profiles_deletion_scheduled
  on public.profiles (account_deletion_scheduled_at)
  where account_deletion_scheduled_at is not null;

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set
    account_deletion_requested_at = now(),
    account_deletion_scheduled_at = now() + interval '30 days',
    updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set
    account_deletion_requested_at = null,
    account_deletion_scheduled_at = null,
    updated_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
