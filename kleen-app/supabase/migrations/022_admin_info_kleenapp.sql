-- ============================================================================
-- KLEEN — Migration 022: Main admin user info@kleenapp.co.uk
-- Ensures info@kleenapp.co.uk has role=admin in public.profiles.
--
-- Create the auth user in Supabase Dashboard first (Auth → Users → Add user):
--   Email: info@kleenapp.co.uk
--   Password: (your chosen password)
-- Then run this migration so their profile gets role=admin.
-- ============================================================================

do $$
declare
  existing_uid uuid;
begin
  select id into existing_uid from auth.users where email = 'info@kleenapp.co.uk' limit 1;

  if existing_uid is not null then
    insert into public.profiles (id, email, full_name, role)
    values (
      existing_uid,
      'info@kleenapp.co.uk',
      coalesce((select full_name from public.profiles where id = existing_uid), 'Kleen Admin'),
      'admin'
    )
    on conflict (id) do update set role = 'admin', email = 'info@kleenapp.co.uk';
    raise notice 'info@kleenapp.co.uk set as admin.';
  else
    raise notice 'No user info@kleenapp.co.uk found. Create them in Supabase Dashboard (Auth → Users → Add user), then re-run this migration.';
  end if;
end $$;
