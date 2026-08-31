-- ============================================================================
-- KLEEN — Migration 064: Admin org structure, permissions, staff HR records
-- (PART 2 of 2 — requires 063 enum values to be committed first)
-- ============================================================================

alter table public.profiles
  add column if not exists admin_permissions jsonb not null default '[]'::jsonb;

alter table public.admin_email_allowlist
  add column if not exists admin_permissions jsonb not null default '[]'::jsonb;

comment on column public.profiles.admin_permissions is
  'Explicit permission grants (subset). Effective access = role template + grants, capped by granter at invite time.';

-- HR / employment records for internal staff (contracts, reporting line)
create table if not exists public.admin_staff_records (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  job_title text,
  department text,
  employment_status text not null default 'active'
    check (employment_status in ('onboarding', 'active', 'suspended', 'terminated')),
  start_date date,
  reports_to uuid references public.profiles(id) on delete set null,
  contract_storage_path text,
  contract_filename text,
  contract_uploaded_at timestamptz,
  contract_uploaded_by uuid references public.profiles(id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_staff_records_reports_to
  on public.admin_staff_records (reports_to);

create index if not exists idx_admin_staff_records_status
  on public.admin_staff_records (employment_status);

alter table public.admin_staff_records enable row level security;

drop policy if exists "Admins read admin_staff_records" on public.admin_staff_records;
create policy "Admins read admin_staff_records"
  on public.admin_staff_records for select
  using (public.is_admin());

drop policy if exists "Admins manage admin_staff_records" on public.admin_staff_records;
create policy "Admins manage admin_staff_records"
  on public.admin_staff_records for all
  using (public.is_admin());

-- Private bucket for employment contract PDFs (admin portal only via service role signed URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'admin-staff-contracts',
  'admin-staff-contracts',
  false,
  10485760,
  array['application/pdf']::text[]
where not exists (select 1 from storage.buckets where id = 'admin-staff-contracts');

drop policy if exists "Admins read admin staff contracts" on storage.objects;
create policy "Admins read admin staff contracts"
  on storage.objects for select
  using (bucket_id = 'admin-staff-contracts' and public.is_admin());

drop policy if exists "Admins upload admin staff contracts" on storage.objects;
create policy "Admins upload admin staff contracts"
  on storage.objects for insert
  with check (bucket_id = 'admin-staff-contracts' and public.is_admin());

-- Master admin alias: info@ stays top tier (safe now — enum values committed in 063)
update public.profiles
set admin_role = 'master_admin'::public.admin_staff_role
where role = 'admin'
  and admin_role = 'superadmin'::public.admin_staff_role
  and lower(email) = lower('info@kleenapp.co.uk');

update public.admin_email_allowlist
set admin_role = 'master_admin'::public.admin_staff_role
where lower(email) = lower('info@kleenapp.co.uk');

-- handle_new_user: copy permissions from allowlist
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := 'customer';
  v_admin_role public.admin_staff_role := null;
  v_admin_permissions jsonb := '[]'::jsonb;
  v_role_text text;
begin
  if exists (select 1 from public.admin_email_allowlist a where lower(a.email) = lower(new.email)) then
    v_role := 'admin'::public.user_role;
    select a.admin_role, coalesce(a.admin_permissions, '[]'::jsonb)
    into v_admin_role, v_admin_permissions
    from public.admin_email_allowlist a
    where lower(a.email) = lower(new.email)
    limit 1;
  else
    v_role_text := new.raw_user_meta_data ->> 'role';
    if v_role_text in ('customer', 'operative', 'admin') then
      v_role := v_role_text::public.user_role;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, admin_role, admin_permissions)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    v_role,
    case when v_role = 'admin'::public.user_role then coalesce(v_admin_role, 'staff'::public.admin_staff_role) else null end,
    case when v_role = 'admin'::public.user_role then v_admin_permissions else '[]'::jsonb end
  );
  return new;
end;
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.admin_role in ('superadmin'::public.admin_staff_role, 'master_admin'::public.admin_staff_role)
  );
$$;
