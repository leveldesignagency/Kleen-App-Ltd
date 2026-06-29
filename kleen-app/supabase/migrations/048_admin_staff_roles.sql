-- ============================================================================
-- KLEEN — Migration 048: Admin staff roles + per-user preferences
-- superadmin: manage team, full access | staff: standard admin portal
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_staff_role') then
    create type public.admin_staff_role as enum ('superadmin', 'staff');
  end if;
end $$;

alter table public.profiles
  add column if not exists admin_role public.admin_staff_role,
  add column if not exists admin_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.admin_role is 'Set for role=admin users: superadmin can manage staff; staff is standard ops access.';
comment on column public.profiles.admin_preferences is 'Per-staff UI settings (display density, sounds, etc.) stored as JSON.';

alter table public.admin_email_allowlist
  add column if not exists admin_role public.admin_staff_role not null default 'staff';

comment on column public.admin_email_allowlist.admin_role is 'Role granted when a new auth user is created with this email.';

-- info@ remains superadmin; use dedicated staff emails for new hires (see docs/ADMIN_STAFF_ACCESS.md)
update public.admin_email_allowlist
set admin_role = 'superadmin'
where lower(email) = lower('info@kleenapp.co.uk');

update public.profiles
set admin_role = 'superadmin'
where role = 'admin' and lower(email) = lower('info@kleenapp.co.uk');

update public.profiles
set admin_role = 'staff'
where role = 'admin' and admin_role is null;

-- New auth users on allowlist inherit admin_role on profile
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := 'customer';
  v_admin_role public.admin_staff_role := null;
  v_role_text text;
begin
  if exists (select 1 from public.admin_email_allowlist a where lower(a.email) = lower(new.email)) then
    v_role := 'admin'::public.user_role;
    select a.admin_role into v_admin_role
    from public.admin_email_allowlist a
    where lower(a.email) = lower(new.email)
    limit 1;
  else
    v_role_text := new.raw_user_meta_data ->> 'role';
    if v_role_text in ('customer', 'operative', 'admin') then
      v_role := v_role_text::public.user_role;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, admin_role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    v_role,
    case when v_role = 'admin'::public.user_role then coalesce(v_admin_role, 'staff'::public.admin_staff_role) else null end
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
      and p.admin_role = 'superadmin'
  );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;
