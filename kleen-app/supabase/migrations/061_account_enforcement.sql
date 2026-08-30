-- ============================================================================
-- KLEEN — Migration 061: Account enforcement (risk flags, bans, appeals, blocklist)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Risk flags (system + manual)
-- -----------------------------------------------------------------------------

create table if not exists public.account_risk_flags (
  id            uuid primary key default gen_random_uuid(),
  subject_type  text not null check (subject_type in ('customer', 'contractor')),
  subject_id    uuid not null,
  flag_type     text not null,
  severity      text not null default 'warning' check (severity in ('info', 'warning', 'high', 'critical')),
  source        text not null default 'system' check (source in ('system', 'admin', 'dispute')),
  reference_id  uuid,
  notes         text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles (id) on delete set null
);

create index if not exists idx_risk_flags_subject
  on public.account_risk_flags (subject_type, subject_id, created_at desc)
  where resolved_at is null;

create index if not exists idx_risk_flags_type
  on public.account_risk_flags (flag_type, severity)
  where resolved_at is null;

-- -----------------------------------------------------------------------------
-- Account bans (temporary or permanent)
-- -----------------------------------------------------------------------------

create table if not exists public.account_bans (
  id              uuid primary key default gen_random_uuid(),
  subject_type    text not null check (subject_type in ('customer', 'contractor')),
  subject_id      uuid not null,
  ban_type        text not null check (ban_type in ('temporary', 'permanent')),
  reason_code     text not null default 'policy_violation',
  reason          text not null,
  expires_at      timestamptz,
  appeal_allowed  boolean not null default true,
  placed_by       uuid references public.profiles (id) on delete set null,
  placed_at       timestamptz not null default now(),
  lifted_at       timestamptz,
  lifted_by       uuid references public.profiles (id) on delete set null,
  lift_reason     text
);

create index if not exists idx_account_bans_active
  on public.account_bans (subject_type, subject_id)
  where lifted_at is null;

-- -----------------------------------------------------------------------------
-- Identity blocklist (permanent bans — blocks re-registration)
-- -----------------------------------------------------------------------------

create table if not exists public.identity_blocklist (
  id            uuid primary key default gen_random_uuid(),
  block_type    text not null check (block_type in (
    'email', 'phone', 'postcode_address', 'company_number', 'vat_number'
  )),
  block_key     text not null,
  display_hint  text,
  source_ban_id uuid references public.account_bans (id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (block_type, block_key)
);

create index if not exists idx_identity_blocklist_key
  on public.identity_blocklist (block_type, block_key);

-- -----------------------------------------------------------------------------
-- Ban appeals
-- -----------------------------------------------------------------------------

create table if not exists public.ban_appeals (
  id                  uuid primary key default gen_random_uuid(),
  ban_id              uuid not null references public.account_bans (id) on delete cascade,
  appellant_user_id   uuid not null references public.profiles (id) on delete cascade,
  message             text not null,
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by         uuid references public.profiles (id) on delete set null,
  reviewed_at         timestamptz,
  review_notes        text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_ban_appeals_status
  on public.ban_appeals (status, created_at desc);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.normalize_block_key(p_type text, p_value text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'email' then lower(trim(p_value))
    when 'phone' then regexp_replace(p_value, '\D', '', 'g')
    when 'postcode_address' then lower(
      regexp_replace(
        regexp_replace(coalesce(p_value, ''), '[^a-zA-Z0-9]', '', 'g'),
        '\s+', '', 'g'
      )
    )
    when 'company_number' then upper(regexp_replace(trim(coalesce(p_value, '')), '\s+', '', 'g'))
    when 'vat_number' then upper(regexp_replace(trim(coalesce(p_value, '')), '\s+', '', 'g'))
    else lower(trim(coalesce(p_value, '')))
  end;
$$;

create or replace function public.has_active_account_ban(p_subject_type text, p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_bans b
    where b.subject_type = p_subject_type
      and b.subject_id = p_subject_id
      and b.lifted_at is null
      and (b.expires_at is null or b.expires_at > now())
  );
$$;

create or replace function public.is_auth_user_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = p_user_id and coalesce(p.is_blocked, false) = true
    )
    or public.has_active_account_ban('customer', p_user_id)
    or exists (
      select 1
      from public.operatives o
      where o.user_id = p_user_id
        and public.has_active_account_ban('contractor', o.id)
    );
$$;

create or replace function public.is_identity_blocked(p_block_type text, p_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.identity_blocklist ib
    where ib.block_type = p_block_type
      and ib.block_key = public.normalize_block_key(p_block_type, p_value)
  );
$$;

-- Refresh risk flags for a customer based on dispute history
create or replace function public.refresh_customer_risk_flags(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_active int;
  v_recent int;
begin
  if p_user_id is null then return; end if;

  select count(*)::int,
         count(*) filter (where status in ('open', 'under_review', 'escalated'))::int,
         count(*) filter (where created_at > now() - interval '12 months')::int
  into v_total, v_active, v_recent
  from public.disputes
  where user_id = p_user_id;

  -- Resolve stale auto-flags
  update public.account_risk_flags
  set resolved_at = now()
  where subject_type = 'customer'
    and subject_id = p_user_id
    and source = 'system'
    and flag_type like 'disputes_%'
    and resolved_at is null;

  if v_recent >= 5 then
    insert into public.account_risk_flags (subject_type, subject_id, flag_type, severity, source, notes)
    values (
      'customer', p_user_id, 'disputes_excessive', 'critical', 'system',
      format('%s disputes in the last 12 months', v_recent)
    );
  elsif v_recent >= 3 then
    insert into public.account_risk_flags (subject_type, subject_id, flag_type, severity, source, notes)
    values (
      'customer', p_user_id, 'disputes_elevated', 'high', 'system',
      format('%s disputes in the last 12 months', v_recent)
    );
  elsif v_recent >= 2 then
    insert into public.account_risk_flags (subject_type, subject_id, flag_type, severity, source, notes)
    values (
      'customer', p_user_id, 'disputes_repeat', 'warning', 'system',
      format('%s disputes in the last 12 months', v_recent)
    );
  end if;

  if v_active >= 2 then
    insert into public.account_risk_flags (subject_type, subject_id, flag_type, severity, source, notes)
    values (
      'customer', p_user_id, 'disputes_multiple_active', 'high', 'system',
      format('%s active disputes', v_active)
    );
  end if;
end;
$$;

create or replace function public.refresh_contractor_risk_flags(p_operative_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disputes int;
  v_recent int;
begin
  if p_operative_id is null then return; end if;

  select count(distinct d.id)::int,
         count(distinct d.id) filter (where d.created_at > now() - interval '6 months')::int
  into v_disputes, v_recent
  from public.disputes d
  join public.job_assignments ja on ja.job_id = d.job_id
  where ja.operative_id = p_operative_id;

  update public.account_risk_flags
  set resolved_at = now()
  where subject_type = 'contractor'
    and subject_id = p_operative_id
    and source = 'system'
    and flag_type like 'disputes_%'
    and resolved_at is null;

  if v_recent >= 4 then
    insert into public.account_risk_flags (subject_type, subject_id, flag_type, severity, source, notes)
    values (
      'contractor', p_operative_id, 'disputes_excessive', 'critical', 'system',
      format('%s disputes on assigned jobs in 6 months', v_recent)
    );
  elsif v_recent >= 2 then
    insert into public.account_risk_flags (subject_type, subject_id, flag_type, severity, source, notes)
    values (
      'contractor', p_operative_id, 'disputes_elevated', 'high', 'system',
      format('%s disputes on assigned jobs in 6 months', v_recent)
    );
  end if;
end;
$$;

-- Auto-refresh customer risk when dispute opens
create or replace function public.trg_dispute_refresh_customer_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform public.refresh_customer_risk_flags(new.user_id);
    -- Refresh contractor on the job too
    perform public.refresh_contractor_risk_flags(ja.operative_id)
    from public.job_assignments ja
    where ja.job_id = new.job_id
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dispute_refresh_customer_risk on public.disputes;
create trigger trg_dispute_refresh_customer_risk
  after insert on public.disputes
  for each row
  execute function public.trg_dispute_refresh_customer_risk();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.account_risk_flags enable row level security;
alter table public.account_bans enable row level security;
alter table public.identity_blocklist enable row level security;
alter table public.ban_appeals enable row level security;

drop policy if exists "Admins manage risk flags" on public.account_risk_flags;
create policy "Admins manage risk flags"
  on public.account_risk_flags for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage account bans" on public.account_bans;
create policy "Admins manage account bans"
  on public.account_bans for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users see own active ban" on public.account_bans;
create policy "Users see own active ban"
  on public.account_bans for select
  using (
    (subject_type = 'customer' and subject_id = auth.uid())
    or (
      subject_type = 'contractor'
      and subject_id in (select o.id from public.operatives o where o.user_id = auth.uid())
    )
  );

drop policy if exists "Admins manage identity blocklist" on public.identity_blocklist;
create policy "Admins manage identity blocklist"
  on public.identity_blocklist for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage ban appeals" on public.ban_appeals;
create policy "Admins manage ban appeals"
  on public.ban_appeals for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users manage own appeals" on public.ban_appeals;
create policy "Users manage own appeals"
  on public.ban_appeals for select
  using (appellant_user_id = auth.uid());

drop policy if exists "Users submit own appeals" on public.ban_appeals;
create policy "Users submit own appeals"
  on public.ban_appeals for insert
  with check (appellant_user_id = auth.uid());

-- Block banned users from opening new disputes / jobs
drop policy if exists "Users create disputes" on public.disputes;
create policy "Users create disputes"
  on public.disputes for insert
  with check (user_id = auth.uid() and not public.is_auth_user_banned(auth.uid()));

drop policy if exists "Users create own jobs" on public.jobs;
create policy "Users create own jobs"
  on public.jobs for insert
  with check (user_id = auth.uid() and not public.is_auth_user_banned(auth.uid()));

comment on function public.is_auth_user_banned is
  'True when profile is_blocked or an active account_ban applies to the user or their operative record.';
