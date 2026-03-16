-- ============================================================================
-- KLEEN — Migration 025: Admin email allowlist for new users
-- Users whose email is in this list get role=admin when created (e.g. added via
-- Supabase Dashboard). All other new users get role=customer (dashboard users).
-- ============================================================================

create table if not exists public.admin_email_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

comment on table public.admin_email_allowlist is 'Emails that receive role=admin when a new auth user is created (e.g. users added in Supabase Dashboard).';

alter table public.admin_email_allowlist enable row level security;

-- Only admins can read/write; handle_new_user (security definer) can read when creating profiles
create policy "Only admins can manage admin allowlist"
  on public.admin_email_allowlist for all
  using (is_admin())
  with check (is_admin());

-- Seed: staff added via Supabase get admin role
insert into public.admin_email_allowlist (email)
values ('info@kleenapp.co.uk')
on conflict (email) do nothing;

-- Update handle_new_user: if email is in allowlist, set role=admin; else use metadata or customer
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := 'customer';
  v_role_text text;
begin
  -- Users on the admin allowlist (e.g. added via Supabase Dashboard) become admin
  if exists (select 1 from public.admin_email_allowlist a where a.email = new.email) then
    v_role := 'admin'::public.user_role;
  else
    v_role_text := new.raw_user_meta_data ->> 'role';
    if v_role_text in ('customer', 'operative', 'admin') then
      v_role := v_role_text::public.user_role;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    v_role
  );
  return new;
end;
$$;
