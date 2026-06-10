-- Run in Supabase SQL Editor if migration 042 has not been applied yet.
-- Prevents contractors from self-setting is_verified / verified_at on profile updates.

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
