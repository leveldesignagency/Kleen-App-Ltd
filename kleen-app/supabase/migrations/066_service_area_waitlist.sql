-- ============================================================================
-- KLEEN — Migration 066: Service-area waitlist (Kent-only launch)
-- Stores emails of users outside Kent who asked to be notified when we expand.
-- ============================================================================

create table if not exists public.service_area_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  postcode text,
  audience text not null
    check (audience in ('customer', 'contractor')),
  source text,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- email is always stored lowercased by the API (required for onConflict upsert)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_area_waitlist_email_audience_key'
  ) then
    alter table public.service_area_waitlist
      add constraint service_area_waitlist_email_audience_key unique (email, audience);
  end if;
end $$;

create index if not exists idx_service_area_waitlist_created
  on public.service_area_waitlist (created_at desc);

alter table public.service_area_waitlist enable row level security;

drop policy if exists "Admins read service_area_waitlist" on public.service_area_waitlist;
create policy "Admins read service_area_waitlist"
  on public.service_area_waitlist for select
  using (public.is_admin());

comment on table public.service_area_waitlist is
  'Out-of-area (non-Kent) emails collected when users opt in to launch expansion updates.';
