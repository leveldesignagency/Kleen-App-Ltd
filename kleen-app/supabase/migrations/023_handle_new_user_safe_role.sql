-- ============================================================================
-- KLEEN — Migration 023: Safe role parsing in handle_new_user
-- Avoids trigger failure when raw_user_meta_data has invalid or missing "role"
-- (e.g. OAuth provider sends "role": "email"). Only accept enum values.
-- ============================================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := 'customer';
  v_role_text text;
begin
  v_role_text := new.raw_user_meta_data ->> 'role';
  if v_role_text in ('customer', 'operative', 'admin') then
    v_role := v_role_text::public.user_role;
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
