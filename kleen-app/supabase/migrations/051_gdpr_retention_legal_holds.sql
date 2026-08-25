-- ============================================================================
-- KLEEN — Migration 051: GDPR retention, legal holds, anonymisation FKs
-- ============================================================================
-- Goals:
-- 1) Keep job/payment ledgers after account erase (anonymised), not hard-CASCADE wipe
-- 2) Legal holds block purge until released (fraud / safety / legal claims)
-- 3) Contractor ID docs get an explicit retain-until date + purge tracking
-- ============================================================================

-- ── Legal holds (admin/legal only) ───────────────────────────────────────────
create table if not exists public.legal_holds (
  id              uuid primary key default gen_random_uuid(),
  subject_type    text not null check (subject_type in ('user', 'operative', 'job')),
  subject_id      uuid not null,
  reason          text not null check (reason in (
    'fraud', 'safety', 'legal_claim', 'regulatory', 'dispute', 'other'
  )),
  notes           text,
  placed_by       uuid references public.profiles on delete set null,
  placed_at       timestamptz not null default now(),
  released_at     timestamptz,
  released_by     uuid references public.profiles on delete set null,
  release_notes   text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_legal_holds_subject
  on public.legal_holds (subject_type, subject_id)
  where released_at is null;

create index if not exists idx_legal_holds_active
  on public.legal_holds (placed_at desc)
  where released_at is null;

alter table public.legal_holds enable row level security;

drop policy if exists "Admins manage legal_holds" on public.legal_holds;
create policy "Admins manage legal_holds"
  on public.legal_holds for all using (public.is_admin());

-- ── Profile anonymisation markers ────────────────────────────────────────────
alter table public.profiles
  add column if not exists anonymised_at timestamptz,
  add column if not exists anonymisation_note text;

-- ── Job ledger anonymisation ─────────────────────────────────────────────────
alter table public.jobs
  add column if not exists customer_anonymised_at timestamptz,
  add column if not exists customer_display_label text;

-- Allow jobs/payments/disputes to survive profile erase
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs'
      and column_name = 'user_id' and is_nullable = 'NO'
  ) then
    alter table public.jobs alter column user_id drop not null;
  end if;
end $$;

alter table public.jobs drop constraint if exists jobs_user_id_fkey;
alter table public.jobs
  add constraint jobs_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments'
      and column_name = 'user_id' and is_nullable = 'NO'
  ) then
    alter table public.payments alter column user_id drop not null;
  end if;
end $$;

alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- Disputes: nullable user, survive erase
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'disputes'
      and column_name = 'user_id' and is_nullable = 'NO'
  ) then
    alter table public.disputes drop constraint if exists disputes_user_id_fkey;
    alter table public.disputes alter column user_id drop not null;
    alter table public.disputes
      add constraint disputes_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete set null;
  else
    alter table public.disputes drop constraint if exists disputes_user_id_fkey;
    alter table public.disputes
      add constraint disputes_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete set null;
  end if;
end $$;

-- Ratings must not block profile erase
alter table public.job_customer_ratings drop constraint if exists job_customer_ratings_customer_user_id_fkey;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_customer_ratings'
      and column_name = 'customer_user_id'
  ) then
    alter table public.job_customer_ratings alter column customer_user_id drop not null;
    alter table public.job_customer_ratings
      add constraint job_customer_ratings_customer_user_id_fkey
      foreign key (customer_user_id) references public.profiles(id) on delete set null;
  end if;
end $$;

-- ── Contractor document retention ────────────────────────────────────────────
alter table public.operatives
  add column if not exists documents_retain_until date,
  add column if not exists documents_purged_at timestamptz,
  add column if not exists documents_purge_blocked_reason text,
  add column if not exists anonymised_at timestamptz;

comment on column public.operatives.documents_retain_until is
  'ID/vetting docs may be kept until this date unless a legal hold applies. Default policy: 24 months after leave/delete.';

-- Block scheduled deletion while an active legal hold exists on the user
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

  if exists (
    select 1 from public.legal_holds
    where subject_type = 'user'
      and subject_id = auth.uid()
      and released_at is null
  ) then
    raise exception 'Account deletion is blocked while a legal hold is active. Contact privacy@kleenapp.co.uk.';
  end if;

  update public.profiles
  set
    account_deletion_requested_at = now(),
    account_deletion_scheduled_at = now() + interval '30 days',
    updated_at = now()
  where id = auth.uid();
end;
$$;

-- Helper: active hold?
create or replace function public.has_active_legal_hold(
  p_subject_type text,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.legal_holds
    where subject_type = p_subject_type
      and subject_id = p_subject_id
      and released_at is null
  );
$$;

grant execute on function public.has_active_legal_hold(text, uuid) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
